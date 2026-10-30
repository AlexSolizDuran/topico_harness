import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  ConteoTokens,
  EventoProveedor,
  Proveedor,
} from '../../src/provider/index.js'
import {
  cargarConfig,
  credencialDeProveedor,
  ErrorConfiguracion,
  ErrorCredencial,
  ErrorProveedor,
  ejecutarConReintentos,
  ProveedorSimulado,
  sanitizarRegistro,
} from '../../src/provider/index.js'

describe('provider Specification Tests', () => {
  // --------------------------------------------------------------------------
  // Requirement: El sistema expone una interfaz de provider agnóstica del modelo concreto
  // --------------------------------------------------------------------------
  describe('Requirement: El sistema expone una interfaz de provider agnóstica del modelo concreto', () => {
    it('El resto del sistema no distingue el proveedor', async () => {
      // WHEN el sistema procesa una respuesta recibida a través del contrato común
      const proveedor: Proveedor = new ProveedorSimulado({
        nombre: 'proveedor-a',
        respuestas: [{ fragmentosTexto: ['Hola mundo'] }],
      })

      const eventos: EventoProveedor[] = []
      for await (const evento of proveedor.enviar({
        mensajes: [{ rol: 'user', contenido: 'test' }],
      })) {
        eventos.push(evento)
      }

      // THEN puede interpretarla sin conocer qué proveedor la produjo
      expect(eventos[0]).toEqual({ tipo: 'texto', delta: 'Hola mundo' })
      expect(eventos[1]).toMatchObject({ tipo: 'fin', razon: 'completado' })
    })

    it('Se agrega un proveedor nuevo', async () => {
      // WHEN se da de alta un proveedor distinto del configurado
      class ProveedorAlternativo implements Proveedor {
        readonly nombre = 'proveedor-b'
        async *enviar() {
          yield { tipo: 'texto' as const, delta: 'Texto alternativo' }
          yield { tipo: 'fin' as const, razon: 'completado' as const }
        }
      }

      const proveedorNuevo: Proveedor = new ProveedorAlternativo()

      // THEN el bucle y el resto de capacidades no cambian
      const consumidor = async (p: Proveedor) => {
        const deltas: string[] = []
        for await (const ev of p.enviar({ mensajes: [] })) {
          if (ev.tipo === 'texto') deltas.push(ev.delta)
        }
        return deltas.join('')
      }

      const resultado = await consumidor(proveedorNuevo)
      expect(resultado).toBe('Texto alternativo')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Los eventos del provider se traducen a eventos internos
  // --------------------------------------------------------------------------
  describe('Requirement: Los eventos del provider se traducen a eventos internos', () => {
    it('El texto llega fragmentado', async () => {
      // WHEN el provider entrega el texto de una respuesta en fragmentos sucesivos
      const proveedor = new ProveedorSimulado({
        respuestas: [
          { fragmentosTexto: ['Parcial 1, ', 'Parcial 2, ', 'Fin'] },
        ],
      })

      const fragmentos: string[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        if (ev.tipo === 'texto') fragmentos.push(ev.delta)
      }

      // THEN el consumidor recibe los fragmentos como texto continuo de la misma respuesta
      expect(fragmentos).toEqual(['Parcial 1, ', 'Parcial 2, ', 'Fin'])
      expect(fragmentos.join('')).toBe('Parcial 1, Parcial 2, Fin')
    })

    it('Una solicitud de herramienta se expone sin el formato de origen', async () => {
      // WHEN el provider entrega una solicitud de herramienta con su estructura propia
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'call_123',
                nombre: 'read',
                argumentos: { ruta: 'src/index.ts' },
              },
            ],
          },
        ],
      })

      const eventos: EventoProveedor[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        eventos.push(ev)
      }

      // THEN el sistema la expone como un evento interno de solicitud de herramienta, sin esa estructura
      const llamada = eventos.find((e) => e.tipo === 'solicitud_herramienta')
      expect(llamada).toBeDefined()
      expect(llamada).toEqual({
        tipo: 'solicitud_herramienta',
        id: 'call_123',
        nombre: 'read',
        argumentos: { ruta: 'src/index.ts' },
      })
    })

    it('Agregar un provider no obliga a cambiar el consumidor', async () => {
      // WHEN se cambia el provider configurado
      const procesar = async (prov: Proveedor) => {
        const evs: string[] = []
        for await (const ev of prov.enviar({ mensajes: [] })) {
          evs.push(ev.tipo)
        }
        return evs
      }

      const prov1 = new ProveedorSimulado({ nombre: 'p1' })
      const prov2 = new ProveedorSimulado({ nombre: 'p2' })

      // THEN el consumidor de eventos no se modifica
      const tipos1 = await procesar(prov1)
      const tipos2 = await procesar(prov2)
      expect(tipos1).toEqual(tipos2)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El sistema reintenta ante fallos transitorios con espera creciente
  // --------------------------------------------------------------------------
  describe('Requirement: El sistema reintenta ante fallos transitorios con espera creciente', () => {
    it('Límite de tasa', async () => {
      // WHEN el provider responde que se superó el límite de peticiones
      let intentos = 0
      const esperas: number[] = []

      const resultado = await ejecutarConReintentos(
        async (i) => {
          intentos = i
          if (i === 1) {
            throw new ErrorProveedor('Rate limit exceeded', {
              codigoEstado: 429,
            })
          }
          return 'ok'
        },
        {
          esperaInicialMs: 10,
          dormir: (ms) => {
            esperas.push(ms)
            return Promise.resolve()
          },
        },
      )

      // THEN el sistema reintenta después de una espera
      expect(intentos).toBe(2)
      expect(esperas.length).toBe(1)
      expect(esperas[0]).toBe(10)
      expect(resultado).toBe('ok')
    })

    it('Error del servidor', async () => {
      // WHEN el provider responde con un error de servidor
      let intentos = 0
      const esperas: number[] = []

      const resultado = await ejecutarConReintentos(
        async (i) => {
          intentos = i
          if (i < 3) {
            throw new ErrorProveedor('Internal Server Error', {
              codigoEstado: 503,
            })
          }
          return 'recuperado'
        },
        {
          esperaInicialMs: 5,
          dormir: (ms) => {
            esperas.push(ms)
            return Promise.resolve()
          },
        },
      )

      // THEN el sistema reintenta después de una espera
      expect(intentos).toBe(3)
      expect(esperas.length).toBe(2)
      expect(resultado).toBe('recuperado')
    })

    it('La espera aumenta entre intentos', async () => {
      // WHEN el sistema reintenta la misma petición más de una vez
      const esperas: number[] = []

      await expect(
        ejecutarConReintentos(
          async () => {
            throw new ErrorProveedor('Server Overloaded', { codigoEstado: 502 })
          },
          {
            maxIntentos: 3,
            esperaInicialMs: 100,
            factorMultiplicador: 2,
            dormir: (ms) => {
              esperas.push(ms)
              return Promise.resolve()
            },
          },
        ),
      ).rejects.toThrow('Server Overloaded')

      // THEN la espera entre intentos sucesivos es mayor que la anterior
      expect(esperas.length).toBe(2)
      expect(esperas[0]).toBe(100)
      expect(esperas[1]).toBe(200)
      expect(esperas[1] ?? 0).toBeGreaterThan(esperas[0] ?? 0)
    })

    it('Un fallo que no es transitorio', async () => {
      // WHEN el provider rechaza la petición por un error de sus propios datos
      let llamadas = 0

      await expect(
        ejecutarConReintentos(
          async (i) => {
            llamadas = i
            throw new ErrorProveedor('Bad Request: invalid json', {
              codigoEstado: 400,
            })
          },
          {
            maxIntentos: 3,
            dormir: () => Promise.resolve(),
          },
        ),
      ).rejects.toThrow('Bad Request: invalid json')

      // THEN el sistema no reintenta y devuelve el fallo de inmediato
      expect(llamadas).toBe(1)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La credencial se lee del entorno y nunca se expone
  // --------------------------------------------------------------------------
  describe('Requirement: La credencial se lee del entorno y nunca se expone', () => {
    it('Un fallo de red no expone la credencial', async () => {
      // WHEN una petición falla por un error de conexión
      const secreto = 'sk-ant-api-secreto-super-confidencial'
      const proveedor = new ProveedorSimulado({
        variableEntornoApiKey: 'MI_API_KEY',
        entorno: { MI_API_KEY: secreto },
        respuestas: [
          {
            fallo: {
              codigoEstado: 500,
              mensaje: `Fallo de red hacia https://api.service?key=${secreto}`,
              esTransitorio: false,
            },
          },
        ],
      })

      // THEN el mensaje de error devuelto no contiene la credencial
      try {
        for await (const _ of proveedor.enviar({ mensajes: [] })) {
          // consumo
        }
        expect.unreachable('Debió lanzar excepción')
      } catch (error) {
        const mensaje = (error as Error).message
        expect(mensaje).not.toContain(secreto)
        expect(mensaje).toContain('[REDACTADO]')
      }
    })

    it('El registro de una petición no la contiene', () => {
      // WHEN el sistema registra la petición que realizó
      const secreto = 'bearer-secreto-12345'
      const registroOriginal = {
        url: 'https://api.provider.com/v1/messages',
        headers: {
          authorization: `Bearer ${secreto}`,
          'x-api-key': secreto,
          'content-type': 'application/json',
        },
        cuerpo: { modelo: 'claude-3-5', claveSecundaria: secreto },
      }

      const registroSanitizado = sanitizarRegistro(registroOriginal, [secreto])

      // THEN el registro no incluye la credencial ni los encabezados que la portan
      expect(registroSanitizado.headers.authorization).toBe('[REDACTADO]')
      expect(registroSanitizado.headers['x-api-key']).toBe('[REDACTADO]')
      expect(registroSanitizado.cuerpo.claveSecundaria).toBe('[REDACTADO]')
      expect(JSON.stringify(registroSanitizado)).not.toContain(secreto)
    })

    it('Falta la credencial', async () => {
      // WHEN el entorno no define la credencial del provider configurado
      const proveedor = new ProveedorSimulado({
        variableEntornoApiKey: 'ANTHROPIC_API_KEY_INEXISTENTE',
        entorno: {},
      })

      // THEN el sistema informa que falta antes de intentar la petición, en lugar de enviarla mal formada
      await expect(async () => {
        for await (const _ of proveedor.enviar({ mensajes: [] })) {
          // consumo
        }
      }).rejects.toThrow(ErrorCredencial)
    })

    it('El config del proyecto rechaza la clave literal', () => {
      // WHEN .harness/config.json del proyecto declara apiKey en un proveedor
      const dir = mkdtempSync(join(tmpdir(), 'harness-cfg-proy-'))
      try {
        mkdirSync(join(dir, '.harness'), { recursive: true })
        const secretoLiteral = 'sk-or-v1-secreto-prohibido-999'
        writeFileSync(
          join(dir, '.harness', 'config.json'),
          JSON.stringify({
            proveedores: {
              openrouter: {
                tipo: 'openai-compatible',
                baseUrl: 'https://openrouter.ai/api/v1',
                apiKey: secretoLiteral,
                modelos: [{ id: 'gpt-4o' }],
              },
            },
          }),
        )

        // THEN el arranque falla indicando que debe usarse variableApiKey con .env, sin mostrar el valor de la clave
        try {
          cargarConfig({
            directorioProyecto: dir,
            directorioGlobal: join(dir, 'no-existe.json'),
          })
          expect.unreachable('Debió rechazar apiKey literal en el proyecto')
        } catch (error) {
          expect(error).toBeInstanceOf(ErrorConfiguracion)
          const msg = (error as Error).message
          expect(msg).toContain('variableApiKey')
          expect(msg).toContain('.env')
          expect(msg).not.toContain(secretoLiteral)
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('El config global admite la clave literal', () => {
      // WHEN el archivo de configuración global del usuario declara apiKey
      const dir = mkdtempSync(join(tmpdir(), 'harness-cfg-global-'))
      try {
        const rutaGlobal = join(dir, 'global-config.json')
        writeFileSync(
          rutaGlobal,
          JSON.stringify({
            proveedores: {
              openrouter: {
                tipo: 'openai-compatible',
                baseUrl: 'https://openrouter.ai/api/v1',
                apiKey: 'sk-global-key-1234',
                modelos: [{ id: 'gpt-4o' }],
              },
            },
          }),
        )

        // THEN el sistema la acepta sin error
        const cfg = cargarConfig({
          directorioProyecto: dir,
          directorioGlobal: rutaGlobal,
        })
        const prov = cfg.proveedores.openrouter
        expect(prov).toBeDefined()
        if (prov) {
          expect(credencialDeProveedor(prov, {})).toBe('sk-global-key-1234')
        }
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })

    it('Falta la variable declarada en el config', () => {
      // WHEN el proveedor declara variableApiKey y la variable no está en el entorno ni en .env
      const proveedorCfg = {
        tipo: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        variableApiKey: 'OPENROUTER_API_KEY',
        modelos: [{ id: 'gpt-4o' }],
      }

      // THEN el sistema informa qué variable falta y que puede definirse en .env
      try {
        credencialDeProveedor(proveedorCfg, {})
        expect.unreachable('Debió fallar por falta de variableApiKey')
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorConfiguracion)
        const msg = (error as Error).message
        expect(msg).toContain('OPENROUTER_API_KEY')
        expect(msg).toContain('.env')
      }
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El sistema expone el conteo de tokens que reporta el provider
  // --------------------------------------------------------------------------
  describe('Requirement: El sistema expone el conteo de tokens que reporta el provider', () => {
    it('El provider reporta el conteo', async () => {
      // WHEN el provider incluye el conteo de tokens en su respuesta
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            fragmentosTexto: ['Texto'],
            tokens: { entrada: 120, salida: 45 },
          },
        ],
      })

      const eventos: EventoProveedor[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        eventos.push(ev)
      }

      // THEN el sistema lo expone entre sus eventos internos
      const fin = eventos.find((e) => e.tipo === 'fin')
      expect(fin).toBeDefined()
      expect(fin).toMatchObject({
        tipo: 'fin',
        tokens: { entrada: 120, salida: 45 },
      })
    })

    it('El provider no reporta el conteo', async () => {
      // WHEN el provider termina una respuesta sin incluir el conteo
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            fragmentosTexto: ['Texto sin conteo'],
            tokens: undefined,
          },
        ],
      })

      const eventos: EventoProveedor[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        eventos.push(ev)
      }

      // THEN el sistema lo expone como ausente y no lo sustituye por un valor estimado
      const fin = eventos.find((e) => e.tipo === 'fin')
      expect(fin).toBeDefined()
      if (fin?.tipo === 'fin') {
        expect(fin.tokens).toBeUndefined()
      }
    })

    it('Un dato con la misma forma para cualquier provider', async () => {
      // WHEN el sistema expone el conteo de tokens de la respuesta
      const provA = new ProveedorSimulado({
        nombre: 'prov-a',
        respuestas: [{ tokens: { entrada: 10, salida: 20 } }],
      })
      const provB = new ProveedorSimulado({
        nombre: 'prov-b',
        respuestas: [{ tokens: { entrada: 30, salida: 40 } }],
      })

      let tokensA: ConteoTokens | undefined
      let tokensB: ConteoTokens | undefined

      for await (const ev of provA.enviar({ mensajes: [] })) {
        if (ev.tipo === 'fin') tokensA = ev.tokens
      }
      for await (const ev of provB.enviar({ mensajes: [] })) {
        if (ev.tipo === 'fin') tokensB = ev.tokens
      }

      // THEN lo hace con la misma forma con la que lo expondría de cualquier otro provider
      expect(tokensA).toHaveProperty('entrada')
      expect(tokensA).toHaveProperty('salida')
      expect(tokensB).toHaveProperty('entrada')
      expect(tokensB).toHaveProperty('salida')
      expect(typeof tokensA?.entrada).toBe('number')
      expect(typeof tokensB?.entrada).toBe('number')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El fin de la respuesta distingue entre terminado e interrumpido
  // --------------------------------------------------------------------------
  describe('Requirement: El fin de la respuesta distingue entre terminado e interrumpido', () => {
    it('El provider completa la respuesta', async () => {
      // WHEN el provider termina la respuesta por sí mismo
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Completo'], interrumpido: false }],
      })

      const eventos: EventoProveedor[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        eventos.push(ev)
      }

      // THEN el evento de fin informa que la respuesta está completa
      const fin = eventos.find((e) => e.tipo === 'fin')
      expect(fin).toEqual({
        tipo: 'fin',
        razon: 'completado',
        tokens: undefined,
      })
    })

    it('La respuesta se interrumpe por un límite', async () => {
      // WHEN la respuesta se corta porque el turno alcanzó su límite
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            fragmentosTexto: ['Incompleto...'],
            interrumpido: true,
            motivoInterrupcion: 'max_tokens',
          },
        ],
      })

      const eventos: EventoProveedor[] = []
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        eventos.push(ev)
      }

      // THEN el evento de fin informa que fue interrumpida y señala el motivo
      const fin = eventos.find((e) => e.tipo === 'fin')
      expect(fin).toEqual({
        tipo: 'fin',
        razon: 'interrumpido',
        motivo: 'max_tokens',
        tokens: undefined,
      })
    })

    it('Una interrupción no se presenta como una respuesta completa', async () => {
      // WHEN una respuesta terminó interrumpida
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            interrumpido: true,
            motivoInterrupcion: 'abortado_por_usuario',
          },
        ],
      })

      let razonFin = ''
      for await (const ev of proveedor.enviar({ mensajes: [] })) {
        if (ev.tipo === 'fin') razonFin = ev.razon
      }

      // THEN el sistema no la reporta como completa ni la da por cerrada
      expect(razonFin).not.toBe('completado')
      expect(razonFin).toBe('interrumpido')
    })
  })
})
