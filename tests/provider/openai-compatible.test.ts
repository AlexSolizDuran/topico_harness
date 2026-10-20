import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  type ConfiguracionHarness,
  cargarConfig,
  crearProveedorOpenAICompatible,
  credencialDeProveedor,
  dividirIdModelo,
  ErrorConfiguracion,
  ErrorProveedor,
  resolverModeloConfig,
} from '../../src/provider/index.js'
import type { EventoProveedor } from '../../src/types.js'

interface PeticionCapturada {
  url: string
  headers: Record<string, string | string[] | undefined>
  cuerpo: Record<string, unknown>
}

interface GuionHttp {
  estado?: number
  cuerpo: string
  tipo?: string
  partirEnDos?: boolean
}

async function levantarServidor(guiones: GuionHttp[]): Promise<{
  url: string
  peticiones: PeticionCapturada[]
  cerrar: () => Promise<void>
}> {
  const peticiones: PeticionCapturada[] = []
  let indice = 0

  const servidor: Server = createServer((req, res) => {
    let crudo = ''
    req.on('data', (parte) => {
      crudo += parte
    })
    req.on('end', async () => {
      peticiones.push({
        url: req.url ?? '',
        headers: req.headers,
        cuerpo: JSON.parse(crudo) as Record<string, unknown>,
      })

      const guion = guiones[indice++]
      if (!guion) {
        res.statusCode = 500
        res.end('sin guion')
        return
      }

      res.statusCode = guion.estado ?? 200
      res.setHeader('Content-Type', guion.tipo ?? 'text/event-stream')

      if (guion.partirEnDos) {
        const mitad = Math.floor(guion.cuerpo.length / 2)
        res.write(guion.cuerpo.slice(0, mitad))
        await new Promise((r) => setTimeout(r, 5))
        res.write(guion.cuerpo.slice(mitad))
      } else {
        res.write(guion.cuerpo)
      }
      res.end()
    })
  })

  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve))
  const direccion = servidor.address()
  const puerto = typeof direccion === 'object' && direccion ? direccion.port : 0

  return {
    url: `http://127.0.0.1:${puerto}/v1`,
    peticiones,
    cerrar: () =>
      new Promise<void>((resolve) => {
        servidor.close(() => resolve())
      }),
  }
}

async function recolectar(
  generador: AsyncGenerator<EventoProveedor, void, unknown>,
): Promise<EventoProveedor[]> {
  const eventos: EventoProveedor[] = []
  for await (const evento of generador) {
    eventos.push(evento)
  }
  return eventos
}

const OPCIONES_REINTENTO = {
  maxIntentos: 3,
  esperaInicialMs: 1,
  dormir: () => Promise.resolve(),
}

describe('Adaptador OpenAI-compatible', () => {
  let cerrar: (() => Promise<void>) | undefined

  afterEach(async () => {
    if (cerrar) await cerrar()
    cerrar = undefined
  })

  it('traduce mensajes, sistema y herramientas al body de OpenAI', async () => {
    const servidor = await levantarServidor([
      {
        cuerpo:
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: servidor.url,
      apiKey: 'sk-test-1234',
      cabecerasExtra: { 'X-Title': 'harness' },
      maxTokensSalida: 512,
      fetchImpl: fetch,
      opcionesReintento: OPCIONES_REINTENTO,
    })

    await recolectar(
      proveedor.enviar({
        sistema: 'Sos un agente',
        mensajes: [
          { rol: 'user', contenido: 'hola' },
          {
            rol: 'assistant',
            llamadasHerramientas: [
              { id: 'c1', nombre: 'read', argumentos: { ruta: 'a.ts' } },
            ],
          },
          { rol: 'tool', idLlamada: 'c1', resultado: 'contenido' },
        ],
        herramientas: [
          {
            nombre: 'read',
            descripcion: 'lee',
            esquema: { type: 'object', properties: { ruta: {} } },
          },
        ],
      }),
    )

    const peticion = servidor.peticiones[0]
    expect(peticion?.url).toBe('/v1/chat/completions')
    expect(peticion?.headers.authorization).toBe('Bearer sk-test-1234')
    expect(peticion?.headers['x-title']).toBe('harness')

    const cuerpo = peticion?.cuerpo
    expect(cuerpo?.model).toBe('openai/gpt-4o')
    expect(cuerpo?.stream).toBe(true)
    expect(cuerpo?.stream_options).toEqual({ include_usage: true })
    expect(cuerpo?.max_tokens).toBe(512)
    expect(cuerpo?.tools).toHaveLength(1)

    const mensajes = cuerpo?.messages as Array<Record<string, unknown>>
    expect(mensajes[0]).toMatchObject({
      role: 'system',
      content: 'Sos un agente',
    })
    expect(mensajes[1]).toMatchObject({ role: 'user', content: 'hola' })
    expect(mensajes[2]?.tool_calls).toEqual([
      {
        id: 'c1',
        type: 'function',
        function: { name: 'read', arguments: '{"ruta":"a.ts"}' },
      },
    ])
    expect(mensajes[3]).toMatchObject({
      role: 'tool',
      tool_call_id: 'c1',
      content: 'contenido',
    })
  })

  it('reconstruye texto y tool calls partidos entre chunks', async () => {
    const servidor = await levantarServidor([
      {
        partirEnDos: true,
        cuerpo:
          'data: {"choices":[{"delta":{"content":"Hola "}}]}\n\n' +
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read","arguments":"{\\"ru"}}]}}]}\n\n' +
          'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"ta\\":\\"a.ts\\"}"}}]}}]}\n\n' +
          'data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\n' +
          'data: [DONE]\n\n',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: servidor.url,
      apiKey: 'sk-test-1234',
      opcionesReintento: OPCIONES_REINTENTO,
    })

    const eventos = await recolectar(
      proveedor.enviar({ mensajes: [{ rol: 'user', contenido: 'leé a.ts' }] }),
    )

    expect(eventos.filter((e) => e.tipo === 'texto')).toEqual([
      { tipo: 'texto', delta: 'Hola ' },
    ])
    expect(eventos.find((e) => e.tipo === 'solicitud_herramienta')).toEqual({
      tipo: 'solicitud_herramienta',
      id: 'call_1',
      nombre: 'read',
      argumentos: { ruta: 'a.ts' },
    })
    expect(eventos.find((e) => e.tipo === 'fin')).toMatchObject({
      tipo: 'fin',
      razon: 'completado',
      tokens: { entrada: 10, salida: 5 },
    })
  })

  it('El modelo nuevo no soporta herramientas', async () => {
    const servidor = await levantarServidor([
      {
        cuerpo:
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'modelo-sin-tools',
      baseUrl: servidor.url,
      soportaHerramientas: false,
      opcionesReintento: OPCIONES_REINTENTO,
    })

    await recolectar(
      proveedor.enviar({
        mensajes: [{ rol: 'user', contenido: 'hola' }],
        herramientas: [
          {
            nombre: 'read',
            descripcion: 'lee',
            esquema: { type: 'object' },
          },
        ],
      }),
    )

    expect(servidor.peticiones[0]?.cuerpo.tools).toBeUndefined()
  })

  it('no filtra la credencial en el mensaje de error', async () => {
    const servidor = await levantarServidor([
      {
        estado: 401,
        cuerpo: '{"error":{"message":"invalid key sk-test-1234"}}',
        tipo: 'application/json',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: servidor.url,
      apiKey: 'sk-test-1234',
      opcionesReintento: OPCIONES_REINTENTO,
    })

    let capturado: Error | undefined
    try {
      await recolectar(
        proveedor.enviar({ mensajes: [{ rol: 'user', contenido: 'hola' }] }),
      )
    } catch (error) {
      capturado = error as Error
    }

    expect(capturado?.message).toContain('401')
    expect(capturado?.message).not.toContain('sk-test-1234')
    expect(capturado?.message).toContain('[REDACTADO]')
  })

  it('reintenta 429 y no reintenta 400', async () => {
    const servidor = await levantarServidor([
      {
        estado: 429,
        cuerpo: '{"error":{"message":"rate limit"}}',
        tipo: 'application/json',
      },
      {
        cuerpo:
          'data: {"choices":[{"delta":{"content":"ok"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      },
      {
        estado: 400,
        cuerpo: '{"error":{"message":"bad request"}}',
        tipo: 'application/json',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: servidor.url,
      opcionesReintento: OPCIONES_REINTENTO,
    })

    const eventos = await recolectar(
      proveedor.enviar({ mensajes: [{ rol: 'user', contenido: 'hola' }] }),
    )
    expect(eventos.some((e) => e.tipo === 'texto')).toBe(true)
    expect(servidor.peticiones).toHaveLength(2)

    await expect(
      recolectar(
        proveedor.enviar({ mensajes: [{ rol: 'user', contenido: 'otra' }] }),
      ),
    ).rejects.toThrow(ErrorProveedor)
    expect(servidor.peticiones).toHaveLength(3)
  })

  it('respeta la señal de cancelación', async () => {
    const controller = new AbortController()
    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: 'http://127.0.0.1:1/v1',
      fetchImpl: ((_url: string, init?: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const abortar = () =>
            reject(new DOMException('Aborted', 'AbortError'))
          if (init?.signal?.aborted) {
            abortar()
            return
          }
          init?.signal?.addEventListener('abort', abortar, { once: true })
        })
      }) as typeof fetch,
    })

    const flujo = proveedor.enviar({
      mensajes: [{ rol: 'user', contenido: 'hola' }],
      senalCancelacion: controller.signal,
    })
    controller.abort()

    await expect(recolectar(flujo)).rejects.toThrow(/abort/i)
  })

  it('reintenta un 500 transitorio', async () => {
    const servidor = await levantarServidor([
      {
        estado: 500,
        cuerpo: '{"error":{"message":"temporal"}}',
        tipo: 'application/json',
      },
      {
        cuerpo:
          'data: {"choices":[{"delta":{"content":"recuperado"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
      },
    ])
    cerrar = servidor.cerrar

    const proveedor = crearProveedorOpenAICompatible({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      baseUrl: servidor.url,
      opcionesReintento: OPCIONES_REINTENTO,
    })

    const eventos = await recolectar(
      proveedor.enviar({ mensajes: [{ rol: 'user', contenido: 'hola' }] }),
    )

    expect(eventos.some((e) => e.tipo === 'texto')).toBe(true)
    expect(servidor.peticiones).toHaveLength(2)
  })
})

describe('Configuración del provider', () => {
  const dir = mkdtempSync(join(tmpdir(), 'harness-config-'))
  const rutaGlobal = join(dir, 'global.json')

  afterEach(() => {
    rmSync(join(dir, '.harness'), { recursive: true, force: true })
  })

  function escribirProyecto(config: unknown): void {
    const carpeta = join(dir, '.harness')
    mkdirSync(carpeta, { recursive: true })
    writeFileSync(join(carpeta, 'config.json'), JSON.stringify(config), 'utf-8')
  }

  it('carga el config del proyecto', () => {
    escribirProyecto({
      proveedorPorDefecto: 'openrouter',
      modeloPorDefecto: 'openai/gpt-4o',
      proveedores: {
        openrouter: {
          tipo: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api/v1',
          variableApiKey: 'OPENROUTER_API_KEY',
          modelos: [{ id: 'openai/gpt-4o', ventanaContexto: 128000 }],
        },
      },
    })

    const config = cargarConfig({
      directorioProyecto: dir,
      directorioGlobal: rutaGlobal,
    })
    expect(config.proveedorPorDefecto).toBe('openrouter')
    const resuelto = resolverModeloConfig(config)
    expect(resuelto.proveedorId).toBe('openrouter')
    expect(resuelto.modelo.id).toBe('openai/gpt-4o')
  })

  it('el config del proyecto pisa al global', () => {
    writeFileSync(
      rutaGlobal,
      JSON.stringify({
        proveedorPorDefecto: 'global',
        proveedores: {
          global: {
            tipo: 'openai-compatible',
            baseUrl: 'https://global.example/v1',
            modelos: [{ id: 'g-1' }],
          },
        },
      }),
      'utf-8',
    )
    escribirProyecto({
      proveedorPorDefecto: 'proyecto',
      proveedores: {
        proyecto: {
          tipo: 'openai-compatible',
          baseUrl: 'https://proyecto.example/v1',
          modelos: [{ id: 'p-1' }],
        },
      },
    })

    const config = cargarConfig({
      directorioProyecto: dir,
      directorioGlobal: rutaGlobal,
    })
    expect(Object.keys(config.proveedores).sort()).toEqual([
      'global',
      'proyecto',
    ])
    expect(config.proveedorPorDefecto).toBe('proyecto')
  })

  it('rechaza JSON inválido', () => {
    const carpeta = join(dir, '.harness')
    mkdirSync(carpeta, { recursive: true })
    writeFileSync(join(carpeta, 'config.json'), '{ roto', 'utf-8')

    expect(() =>
      cargarConfig({ directorioProyecto: dir, directorioGlobal: rutaGlobal }),
    ).toThrow(ErrorConfiguracion)
  })

  it('resuelve un id con barra sin romper openai/gpt-4o', () => {
    const config: ConfiguracionHarness = {
      proveedores: {
        openrouter: {
          tipo: 'openai-compatible',
          baseUrl: 'https://openrouter.ai/api/v1',
          modelos: [{ id: 'openai/gpt-4o' }],
        },
      },
    }
    const dividido = dividirIdModelo(
      'openrouter/openai/gpt-4o',
      config.proveedores,
    )
    expect(dividido).toEqual({
      proveedorId: 'openrouter',
      modeloId: 'openai/gpt-4o',
    })
  })

  it('exige la variable de entorno declarada', () => {
    expect(() =>
      credencialDeProveedor(
        {
          tipo: 'openai-compatible',
          baseUrl: 'https://example.com',
          variableApiKey: 'NO_EXISTE',
          modelos: [{ id: 'm' }],
        },
        {},
      ),
    ).toThrow(ErrorConfiguracion)
  })

  it('acepta una apiKey literal del config local', () => {
    const credencial = credencialDeProveedor(
      {
        tipo: 'openai-compatible',
        baseUrl: 'https://example.com',
        apiKey: 'sk-local-1234',
        modelos: [{ id: 'm' }],
      },
      {},
    )
    expect(credencial).toBe('sk-local-1234')
  })
})
