import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import {
  type ConfiguracionServidorMcp,
  evaluarPermisoHerramientaMcp,
  GestorMcp,
  type HerramientaMcp,
} from '../../src/mcp/index.js'

describe('mcp specification scenarios', () => {
  describe('Requirement: El sistema declara servidores MCP en la configuración', () => {
    it('Configuración válida', () => {
      const servidor: ConfiguracionServidorMcp = {
        id: 'github',
        comando: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
      }
      const gestor = new GestorMcp({ servidores: [servidor] })
      expect(gestor).toBeDefined()
      gestor.cerrar()
    })

    it('Servidor sin comando', () => {
      const servidorInvalido = {
        id: 'bad-server',
        comando: '',
      } as ConfiguracionServidorMcp

      expect(() => new GestorMcp({ servidores: [servidorInvalido] })).toThrow(
        /bad-server/,
      )
    })

    it('Secreto literal rechazado', () => {
      const servidorConSecreto: ConfiguracionServidorMcp = {
        id: 'secure-server',
        comando: 'node',
        env: {
          GITHUB_TOKEN: 'ghp_secret_token_12345678901234567890',
        },
      }
      expect(() => new GestorMcp({ servidores: [servidorConSecreto] })).toThrow(
        /secreto literal/,
      )
    })

    it('Sin servidores', () => {
      const gestor = new GestorMcp({})
      expect(gestor.obtenerHerramientasVisibles(['any'])).toHaveLength(0)
      gestor.cerrar()
    })
  })

  describe('Requirement: Un servidor se conecta bajo demanda y anuncia sus herramientas', () => {
    it('Conexión bajo demanda', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'mock', comando: 'echo' }],
      })
      const spy = vi
        .spyOn(gestor, 'conectarServidor')
        .mockImplementation(async () => {})
      await gestor.ejecutarHerramienta('mock_test', {})
      expect(spy).toHaveBeenCalledWith('mock')
      gestor.cerrar()
    })

    it('Solo herramientas del servidor conectado', async () => {
      const gestor = new GestorMcp({
        servidores: [
          { id: 's1', comando: 'echo' },
          { id: 's2', comando: 'echo' },
        ],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(
        async (id: string) => {
          const arr = gestor['herramientasConectadas'] as HerramientaMcp[]
          arr.push({
            nombre: 'tool1',
            nombreCompleto: `${id}_tool1`,
            servidor: id,
            descripcion: 'test tool',
            esquema: z.object({}),
          })
        },
      )

      await gestor.conectarServidor('s1')
      const visibles = gestor.obtenerHerramientasVisibles(['s1', 's2'])
      expect(visibles.every((h) => h.servidor === 's1')).toBe(true)
      gestor.cerrar()
    })

    it('Nombre con prefijo del servidor', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'myserver', comando: 'echo' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {
        const arr = gestor['herramientasConectadas'] as HerramientaMcp[]
        arr.push({
          nombre: 'query',
          nombreCompleto: 'myserver_query',
          servidor: 'myserver',
          descripcion: 'run query',
          esquema: z.object({}),
        })
      })

      await gestor.conectarServidor('myserver')
      const visibles = gestor.obtenerHerramientasVisibles(['myserver'])
      expect(visibles[0]?.nombreCompleto).toBe('myserver_query')
      gestor.cerrar()
    })

    it('Orden estable', async () => {
      const gestor = new GestorMcp()
      gestor['herramientasConectadas'] = [
        {
          nombre: 'a',
          nombreCompleto: 's1_a',
          servidor: 's1',
          descripcion: '',
          esquema: z.object({}),
        },
        {
          nombre: 'b',
          nombreCompleto: 's1_b',
          servidor: 's1',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {
        const arr = gestor['herramientasConectadas'] as HerramientaMcp[]
        arr.push({
          nombre: 'c',
          nombreCompleto: 's2_c',
          servidor: 's2',
          descripcion: '',
          esquema: z.object({}),
        })
      })

      await gestor.conectarServidor('s2')
      const herramientas = gestor.obtenerHerramientasVisibles(['s1', 's2'])
      expect(herramientas.map((h) => h.nombreCompleto)).toEqual([
        's1_a',
        's1_b',
        's2_c',
      ])
      gestor.cerrar()
    })

    it('Sin servidores no hay herramientas externas', () => {
      const gestor = new GestorMcp()
      expect(gestor.obtenerHerramientasVisibles([])).toHaveLength(0)
      gestor.cerrar()
    })
  })

  describe('Requirement: Las herramientas MCP se ejecutan con su esquema y devuelven texto', () => {
    it('Argumentos válidos', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'calc', comando: 'node' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi.fn().mockResolvedValue('resultado: 42'),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('calc', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'sum',
          nombreCompleto: 'calc_sum',
          servidor: 'calc',
          descripcion: '',
          esquema: z.object({ a: z.number(), b: z.number() }),
        },
      ]

      const res = await gestor.ejecutarHerramienta('calc_sum', { a: 20, b: 22 })
      expect(res).toBe('resultado: 42')
      gestor.cerrar()
    })

    it('Argumentos inválidos', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'calc', comando: 'node' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi.fn(),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('calc', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'sum',
          nombreCompleto: 'calc_sum',
          servidor: 'calc',
          descripcion: '',
          esquema: z.object({ a: z.number() }),
        },
      ]

      const res = await gestor.ejecutarHerramienta('calc_sum', {
        a: 'not-a-number' as unknown as number,
      })
      expect(res).toContain('ERROR: Los argumentos no cumplen el esquema')
      expect(clienteMock.llamarHerramienta).not.toHaveBeenCalled()
      gestor.cerrar()
    })

    it('Resultado truncado', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'data', comando: 'node' }],
        maxBytesSalida: 50,
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const salidaLarga = 'A'.repeat(200)
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi.fn().mockResolvedValue(salidaLarga),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('data', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'get',
          nombreCompleto: 'data_get',
          servidor: 'data',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      const res = await gestor.ejecutarHerramienta('data_get', {})
      expect(res).toContain('omitidos')
      gestor.cerrar()
    })

    it('Error del servidor', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'srv', comando: 'node' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi
          .fn()
          .mockRejectedValue(new Error('Fallo interno de servidor')),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('srv', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'fail',
          nombreCompleto: 'srv_fail',
          servidor: 'srv',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      const res = await gestor.ejecutarHerramienta('srv_fail', {})
      expect(res).toContain('ERROR: Falló la herramienta MCP')
      expect(res).toContain('Fallo interno de servidor')
      gestor.cerrar()
    })

    it('Sanitización de credenciales', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'srv', comando: 'node' }],
        sanitizarCredenciales: (t) =>
          t.replace(/sk-[a-zA-Z0-9]+/g, '[REDACTADO]'),
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi
          .fn()
          .mockResolvedValue('La clave es sk-12345abcd'),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('srv', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'leak',
          nombreCompleto: 'srv_leak',
          servidor: 'srv',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      const res = await gestor.ejecutarHerramienta('srv_leak', {})
      expect(res).not.toContain('sk-12345abcd')
      expect(res).toContain('[REDACTADO]')
      gestor.cerrar()
    })
  })

  describe('Requirement: Un fallo de un servidor no detiene la sesión', () => {
    it('Servidor que no arranca', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'bad', comando: 'non-existent-binary-12345' }],
      })
      const res = await gestor.ejecutarHerramienta('bad_action', {})
      expect(res).toContain('ERROR: No se pudo conectar al servidor MCP')
      gestor.cerrar()
    })

    it('Servidor que se cae', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'crash', comando: 'node' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi
          .fn()
          .mockRejectedValue(
            new Error('Servidor finalizó inesperadamente (exit code 1)'),
          ),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('crash', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'op',
          nombreCompleto: 'crash_op',
          servidor: 'crash',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      const res = await gestor.ejecutarHerramienta('crash_op', {})
      expect(res).toContain('finalizó inesperadamente')
      gestor.cerrar()
    })

    it('Timeout', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'slow', comando: 'node' }],
      })
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {})
      const clienteMock = {
        estaConectado: () => true,
        llamarHerramienta: vi
          .fn()
          .mockRejectedValue(new Error('Timeout de respuesta de servidor MCP')),
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('slow', clienteMock)
      gestor['herramientasConectadas'] = [
        {
          nombre: 'wait',
          nombreCompleto: 'slow_wait',
          servidor: 'slow',
          descripcion: '',
          esquema: z.object({}),
        },
      ]

      const res = await gestor.ejecutarHerramienta('slow_wait', {})
      expect(res).toContain('Timeout')
      gestor.cerrar()
    })

    it('Reintento en otro turno', async () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'retry', comando: 'node' }],
      })
      let fallar = true
      vi.spyOn(gestor, 'conectarServidor').mockImplementation(async () => {
        if (fallar) throw new Error('Servidor no listo')
        const arr = gestor['herramientasConectadas'] as HerramientaMcp[]
        arr.push({
          nombre: 'ping',
          nombreCompleto: 'retry_ping',
          servidor: 'retry',
          descripcion: '',
          esquema: z.object({}),
        })
        const clienteMock = {
          estaConectado: () => true,
          llamarHerramienta: vi.fn().mockResolvedValue('pong'),
          desconectar: vi.fn(),
        }
        const clientesMap = gestor['clientes'] as Map<string, unknown>
        clientesMap.set('retry', clienteMock)
      })

      // Turno 1: Falla
      const res1 = await gestor.ejecutarHerramienta('retry_ping', {})
      expect(res1).toContain('Servidor no listo')

      // Turno 2: Reintento exitoso
      fallar = false
      const res2 = await gestor.ejecutarHerramienta('retry_ping', {})
      expect(res2).toBe('pong')
      gestor.cerrar()
    })

    it('Sin procesos huérfanos', () => {
      const gestor = new GestorMcp({
        servidores: [{ id: 'srv', comando: 'node' }],
      })
      const clienteMock = {
        desconectar: vi.fn(),
      }
      const clientesMap = gestor['clientes'] as Map<string, unknown>
      clientesMap.set('srv', clienteMock)
      gestor.cerrar()
      expect(clienteMock.desconectar).toHaveBeenCalled()
    })
  })

  describe('Requirement: Las herramientas MCP respetan permisos y aprobación obligatoria', () => {
    it('Sin regla se consulta', () => {
      const herramienta: HerramientaMcp = {
        nombre: 'query',
        nombreCompleto: 'db_query',
        servidor: 'db',
        descripcion: 'run query',
        esquema: z.object({}),
      }
      const verificacion = evaluarPermisoHerramientaMcp(herramienta, {
        reglasGlobales: [],
        directorioProyecto: process.cwd(),
        tieneTty: true,
      })
      expect(verificacion.requiereAprobacion).toBe(true)
    })

    it('Regla permitir', () => {
      const herramienta: HerramientaMcp = {
        nombre: 'query',
        nombreCompleto: 'db_query',
        servidor: 'db',
        descripcion: 'run query',
        esquema: z.object({}),
      }
      const verificacion = evaluarPermisoHerramientaMcp(herramienta, {
        reglasGlobales: [
          { accion: 'mcp', recurso: 'db/*', efecto: 'permitir' },
        ],
        directorioProyecto: process.cwd(),
        tieneTty: true,
      })
      expect(verificacion.permitido).toBe(true)
      expect(verificacion.requiereAprobacion).toBe(false)
    })

    it('Regla denegar', () => {
      const herramienta: HerramientaMcp = {
        nombre: 'delete',
        nombreCompleto: 'db_delete',
        servidor: 'db',
        descripcion: 'delete table',
        esquema: z.object({}),
      }
      const verificacion = evaluarPermisoHerramientaMcp(herramienta, {
        reglasGlobales: [
          { accion: 'mcp', recurso: 'db/delete', efecto: 'denegar' },
        ],
        directorioProyecto: process.cwd(),
        tieneTty: true,
      })
      expect(verificacion.permitido).toBe(false)
      expect(verificacion.requiereAprobacion).toBe(false)
      expect(verificacion.motivo).toContain('denegado')
    })

    it('Motivo de riesgo', () => {
      const herramienta: HerramientaMcp = {
        nombre: 'dangerous_action',
        nombreCompleto: 'sec_dangerous_action',
        servidor: 'sec',
        descripcion: 'dangerous',
        esquema: z.object({}),
        riesgoso: true,
        motivoRiesgo: 'Puede modificar la infraestructura en la nube',
      }
      const verificacion = evaluarPermisoHerramientaMcp(herramienta, {
        reglasGlobales: [{ accion: 'mcp', recurso: '*', efecto: 'permitir' }],
        directorioProyecto: process.cwd(),
        tieneTty: true,
      })
      expect(verificacion.requiereAprobacion).toBe(true)
      expect(verificacion.motivo).toContain(
        'Puede modificar la infraestructura',
      )
    })

    it('Sin terminal no se ejecuta lo que requiere aprobación', () => {
      const herramienta: HerramientaMcp = {
        nombre: 'test',
        nombreCompleto: 'srv_test',
        servidor: 'srv',
        descripcion: 'test',
        esquema: z.object({}),
      }
      const verificacion = evaluarPermisoHerramientaMcp(herramienta, {
        reglasGlobales: [{ accion: 'mcp', recurso: '*', efecto: 'consultar' }],
        directorioProyecto: process.cwd(),
        tieneTty: false,
      })
      expect(verificacion.permitido).toBe(false)
      expect(verificacion.requiereAprobacion).toBe(false)
      expect(verificacion.motivo).toContain('no hay terminal interactiva')
    })
  })

  describe('Requirement: Un agente solo ve los servidores MCP que declara', () => {
    it('Agente sin declaración', () => {
      const gestor = new GestorMcp()
      gestor['herramientasConectadas'] = [
        {
          nombre: 'a',
          nombreCompleto: 's1_a',
          servidor: 's1',
          descripcion: '',
          esquema: z.object({}),
        },
      ]
      const visibles = gestor.obtenerHerramientasVisibles(undefined)
      expect(visibles).toHaveLength(0)
      gestor.cerrar()
    })

    it('Agente con un servidor declarado', () => {
      const gestor = new GestorMcp()
      gestor['herramientasConectadas'] = [
        {
          nombre: 'a',
          nombreCompleto: 's1_a',
          servidor: 's1',
          descripcion: '',
          esquema: z.object({}),
        },
        {
          nombre: 'b',
          nombreCompleto: 's2_b',
          servidor: 's2',
          descripcion: '',
          esquema: z.object({}),
        },
      ]
      const visibles = gestor.obtenerHerramientasVisibles(['s1'])
      expect(visibles.map((h) => h.nombreCompleto)).toEqual(['s1_a'])
      gestor.cerrar()
    })

    it('Servidor denegado', () => {
      const gestor = new GestorMcp()
      gestor['herramientasConectadas'] = [
        {
          nombre: 'a',
          nombreCompleto: 's1_a',
          servidor: 's1',
          descripcion: '',
          esquema: z.object({}),
        },
        {
          nombre: 'b',
          nombreCompleto: 's2_b',
          servidor: 's2',
          descripcion: '',
          esquema: z.object({}),
        },
      ]
      // Si el agente o regla deniega s2, no se incluye s2 en servidores permitidos
      const visibles = gestor.obtenerHerramientasVisibles(['s1'])
      expect(visibles.some((h) => h.servidor === 's2')).toBe(false)
      gestor.cerrar()
    })
  })
})
