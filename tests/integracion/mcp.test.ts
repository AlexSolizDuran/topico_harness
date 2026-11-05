import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { construirHarness } from '../../src/app.js'
import {
  crearEntradaHerramientaMcp,
  GestorMcp,
  type HerramientaMcp,
} from '../../src/mcp/index.js'
import { GestorPermisos } from '../../src/permissions/portero.js'
import type { ConfiguracionHarness } from '../../src/provider/config.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

const SERVIDOR_MCP_FALSO = String.raw`
const fs = require('node:fs')
const readline = require('node:readline')

const marcadorFallo = process.argv[2]
const archivoLlamadas = process.argv[3]
const archivoId = process.argv[4]
const archivoTerminado = process.argv[5]

if (archivoId) fs.writeFileSync(archivoId, String(process.pid))

if (marcadorFallo && !fs.existsSync(marcadorFallo)) {
  fs.writeFileSync(marcadorFallo, 'intentado')
  process.exit(1)
}

function enviar(objeto) {
  process.stdout.write(JSON.stringify(objeto) + '\n')
}

const herramientas = [
  {
    name: 'echo',
    description: 'Devuelve el texto recibido',
    inputSchema: {
      type: 'object',
      properties: { texto: { type: 'string' } },
      required: ['texto'],
      additionalProperties: false,
    },
  },
  {
    name: 'env',
    description: 'Devuelve la variable configurada',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'env2',
    description: 'Devuelve una variable ausente',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'peligrosa',
    description: 'Herramienta riesgosa',
    riesgoso: true,
    motivoRiesgo: 'Puede modificar la infraestructura',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
]

const rl = readline.createInterface({ input: process.stdin })

rl.on('line', (linea) => {
  let mensaje
  try {
    mensaje = JSON.parse(linea)
  } catch {
    return
  }

  if (mensaje.method === 'initialize') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'falso', version: '1.0.0' },
      },
    })
    return
  }

  if (mensaje.method === 'tools/list') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: { tools: herramientas },
    })
    return
  }

  if (mensaje.method === 'tools/call') {
    if (archivoLlamadas) {
      fs.appendFileSync(archivoLlamadas, mensaje.params.name + '\n')
    }
    const nombre = mensaje.params.name
    const argumentos = mensaje.params.arguments || {}
    let texto = ''
    if (nombre === 'echo') texto = 'eco:' + argumentos.texto
    else if (nombre === 'env') texto = process.env.MCP_TEST_TOKEN || 'AUSENTE'
    else if (nombre === 'env2') {
      texto = process.env.VARIABLE_INEXISTENTE_XYZ || 'AUSENTE'
    } else if (nombre === 'peligrosa') texto = 'peligro ejecutado'
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: { content: [{ type: 'text', text: texto }] },
    })
    return
  }

  if (mensaje.id !== undefined) {
    enviar({ jsonrpc: '2.0', id: mensaje.id, result: null })
  }
})

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
process.on('exit', () => {
  if (archivoTerminado) fs.writeFileSync(archivoTerminado, 'terminado')
})
`

describe('Integración de MCP', () => {
  const dirs: string[] = []

  function crearProyecto(): {
    dir: string
    rutaServidor: string
    archivoLlamadas: string
    archivoIdUno: string
    archivoIdDos: string
    archivoTerminado: string
  } {
    const dir = mkdtempSync(join(tmpdir(), 'harness-mcp-integracion-'))
    dirs.push(dir)
    const rutaServidor = join(dir, 'mcp-falso.cjs')
    writeFileSync(rutaServidor, SERVIDOR_MCP_FALSO, 'utf-8')
    return {
      dir,
      rutaServidor,
      archivoLlamadas: join(dir, 'llamadas.txt'),
      archivoIdUno: join(dir, 'uno.pid'),
      archivoIdDos: join(dir, 'dos.pid'),
      archivoTerminado: join(dir, 'terminado.txt'),
    }
  }

  function configConServidores(
    rutaServidor: string,
    ids: { uno: string; dos: string },
    terminado: string,
    llamadas: string,
  ): ConfiguracionHarness {
    return {
      proveedores: {
        local: {
          tipo: 'openai-compatible',
          baseUrl: 'http://localhost:11434/v1',
          modelos: [{ id: 'modelo' }],
        },
      },
      mcp: [
        {
          id: 'uno',
          comando: process.execPath,
          args: [rutaServidor, '', llamadas, ids.uno, terminado],
        },
        {
          id: 'dos',
          comando: process.execPath,
          args: [rutaServidor, '', llamadas, ids.dos, terminado],
        },
      ],
    }
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('solo conecta y anuncia los servidores declarados por el agente, al final del orden', async () => {
    const { dir, rutaServidor, archivoIdUno, archivoIdDos, archivoTerminado } =
      crearProyecto()
    const config = configConServidores(
      rutaServidor,
      { uno: archivoIdUno, dos: archivoIdDos },
      archivoTerminado,
      join(dir, 'llamadas.txt'),
    )
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config,
      esInteractivo: false,
      guardarSesiones: false,
      agentes: [
        {
          nombre: 'build',
          descripcion: 'principal',
          modo: 'primario',
          herramientas: [],
          mcp: ['uno'],
        },
      ],
    })

    await harness.sesion.enviarMensaje('hola')

    const nombres =
      proveedor.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre) ?? []
    expect(nombres).toEqual([
      'uno_echo',
      'uno_env',
      'uno_env2',
      'uno_peligrosa',
    ])
    expect(existsSync(archivoIdUno)).toBe(true)
    expect(existsSync(archivoIdDos)).toBe(false)

    await harness.cerrar()
  })

  it('un agente sin declaración no recibe herramientas externas ni las conecta', async () => {
    const { dir, rutaServidor, archivoIdUno, archivoIdDos, archivoTerminado } =
      crearProyecto()
    const config = configConServidores(
      rutaServidor,
      { uno: archivoIdUno, dos: archivoIdDos },
      archivoTerminado,
      join(dir, 'llamadas.txt'),
    )
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config,
      esInteractivo: false,
      guardarSesiones: false,
      agentes: [
        {
          nombre: 'build',
          descripcion: 'principal',
          modo: 'primario',
          herramientas: ['read'],
        },
      ],
    })

    await harness.sesion.enviarMensaje('hola')

    const nombres =
      proveedor.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre) ?? []
    expect(nombres).toEqual(['read'])
    expect(existsSync(archivoIdUno)).toBe(false)
    expect(existsSync(archivoIdDos)).toBe(false)

    await harness.cerrar()
  })

  it('resuelve env por nombre, omite la ausente y no ejecuta con argumentos inválidos', async () => {
    const { dir, rutaServidor, archivoLlamadas } = crearProyecto()
    const anterior = process.env.MCP_TEST_TOKEN
    process.env.MCP_TEST_TOKEN = 'token-desde-entorno'
    try {
      const gestor = new GestorMcp({
        servidores: [
          {
            id: 'fake',
            comando: process.execPath,
            args: [rutaServidor, '', archivoLlamadas, '', ''],
            env: ['MCP_TEST_TOKEN', 'VARIABLE_INEXISTENTE_XYZ'],
          },
        ],
      })

      await gestor.conectarServidor('fake')
      expect(await gestor.ejecutarHerramienta('fake_env', {})).toBe(
        'token-desde-entorno',
      )
      expect(await gestor.ejecutarHerramienta('fake_env2', {})).toBe('AUSENTE')

      writeFileSync(archivoLlamadas, '', 'utf-8')
      const invalido = await gestor.ejecutarHerramienta('fake_echo', {
        texto: 42,
      })
      expect(invalido).toContain('no cumplen el esquema')
      expect(readFileSync(archivoLlamadas, 'utf-8')).not.toContain('echo')

      expect(
        await gestor.ejecutarHerramienta('fake_echo', { texto: 'hola' }),
      ).toBe('eco:hola')

      gestor.cerrar()
    } finally {
      if (anterior === undefined) delete process.env.MCP_TEST_TOKEN
      else process.env.MCP_TEST_TOKEN = anterior
    }
  })

  it('traduce cada herramienta a una entrada con recurso y aprobación obligatoria por riesgo', () => {
    const { dir } = crearProyecto()
    const gestor = new GestorMcp({
      servidores: [{ id: 'fake', comando: 'node' }],
    })
    const herramienta: HerramientaMcp = {
      nombre: 'echo',
      nombreCompleto: 'fake_echo',
      servidor: 'fake',
      descripcion: 'eco',
      esquema: z.object({ texto: z.string() }),
      esquemaJson: {
        type: 'object',
        properties: { texto: { type: 'string' } },
        required: ['texto'],
      },
    }
    const entrada = crearEntradaHerramientaMcp(gestor, herramienta)
    expect(entrada.nombre).toBe('fake_echo')
    expect(entrada.accionPermiso).toBe('mcp')
    expect(entrada.obtenerRecurso?.({})).toBe('fake/echo')
    expect(entrada.esquema).toEqual(herramienta.esquemaJson)

    const permitir = new GestorPermisos({
      directorioProyecto: dir,
      reglasGlobales: [
        { accion: 'mcp', recurso: 'fake/echo', efecto: 'permitir' },
      ],
      esInteractivo: true,
    })
    expect(permitir.evaluar(entrada, {}).efecto).toBe('permitir')

    const denegar = new GestorPermisos({
      directorioProyecto: dir,
      reglasGlobales: [
        { accion: 'mcp', recurso: 'fake/echo', efecto: 'denegar' },
      ],
      esInteractivo: true,
    })
    expect(denegar.evaluar(entrada, {}).efecto).toBe('denegar')

    const riesgosa = crearEntradaHerramientaMcp(gestor, {
      ...herramienta,
      nombre: 'peligrosa',
      nombreCompleto: 'fake_peligrosa',
      riesgoso: true,
      motivoRiesgo: 'Puede modificar la infraestructura',
    })
    const evaluacion = denegar.evaluar(riesgosa, {})
    expect(evaluacion.efecto).toBe('consultar')
    expect(evaluacion.obligatoria).toBe(true)
    expect(evaluacion.motivo).toContain('infraestructura')

    gestor.cerrar()
  })

  it('reintenta la conexión en un turno posterior y cierra el proceso', async () => {
    const { dir, rutaServidor, archivoTerminado } = crearProyecto()
    const marcador = join(dir, 'primer-intento.txt')
    const gestor = new GestorMcp({
      servidores: [
        {
          id: 'fake',
          comando: process.execPath,
          args: [rutaServidor, marcador, '', '', archivoTerminado],
        },
      ],
    })

    await expect(gestor.conectarServidor('fake')).rejects.toThrow()
    await gestor.conectarServidor('fake')
    expect(
      await gestor.ejecutarHerramienta('fake_echo', { texto: 'retry' }),
    ).toBe('eco:retry')

    gestor.cerrar()
    for (
      let intento = 0;
      intento < 40 && !existsSync(archivoTerminado);
      intento++
    ) {
      await new Promise((resolver) => setTimeout(resolver, 50))
    }
    expect(existsSync(archivoTerminado)).toBe(true)
  })
})
