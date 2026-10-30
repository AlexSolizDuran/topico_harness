import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import { ErrorBloqueoHook, GestorHooks } from '../../src/hooks/index.js'
import { GestorPermisos } from '../../src/permissions/index.js'
import {
  cargarConfig,
  ErrorConfiguracion,
  ProveedorSimulado,
} from '../../src/provider/index.js'

describe('hooks Specification Tests (290)', () => {
  const dirs: string[] = []

  function crearDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-hooks-'))
    dirs.push(dir)
    return dir
  }

  function escribirConfigProyecto(
    dir: string,
    extra: Record<string, unknown>,
  ): void {
    mkdirSync(join(dir, '.harness'), { recursive: true })
    writeFileSync(
      join(dir, '.harness', 'config.json'),
      JSON.stringify({
        proveedores: {
          openrouter: {
            tipo: 'openai-compatible',
            baseUrl: 'https://openrouter.ai/api/v1',
            variableApiKey: 'OPENROUTER_API_KEY',
            modelos: [{ id: 'gpt-4o' }],
          },
        },
        ...extra,
      }),
    )
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      try {
        rmSync(dir, { recursive: true, force: true })
      } catch {
        // En Windows un subproceso recién terminado puede retener el directorio unos ms
      }
    }
  })

  describe('Requirement: El sistema declara hooks en la configuración', () => {
    it('Una configuración válida', () => {
      // WHEN el config declara hooks con comando y match válidos
      const dir = crearDir()
      escribirConfigProyecto(dir, {
        hooks: {
          preTool: [{ comando: 'echo ok', match: '^(read|write)$' }],
          turnEnd: [{ comando: 'echo fin' }],
        },
      })

      // THEN el sistema los registra por evento
      const cfg = cargarConfig({
        directorioProyecto: dir,
        directorioGlobal: join(dir, 'no-global.json'),
      })
      expect(cfg.hooks?.preTool).toHaveLength(1)
      expect(cfg.hooks?.turnEnd).toHaveLength(1)
    })

    it('Una entrada sin comando', () => {
      // WHEN una entrada de la lista no declara comando
      const dir = crearDir()
      escribirConfigProyecto(dir, {
        hooks: {
          preTool: [{ match: 'read' }],
        },
      })

      // THEN el arranque falla nombrando el evento y la posición
      try {
        cargarConfig({
          directorioProyecto: dir,
          directorioGlobal: join(dir, 'no-global.json'),
        })
        expect.unreachable('Debió fallar sin comando')
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorConfiguracion)
        const msg = (error as Error).message
        expect(msg).toContain('preTool')
        expect(msg).toContain('1')
      }
    })

    it('Un evento desconocido', () => {
      // WHEN el config declara un evento que no es uno de los cinco
      const dir = crearDir()
      escribirConfigProyecto(dir, {
        hooks: {
          eventoInventado: [{ comando: 'echo x' }],
        },
      })

      // THEN el arranque falla nombrando el evento
      try {
        cargarConfig({
          directorioProyecto: dir,
          directorioGlobal: join(dir, 'no-global.json'),
        })
        expect.unreachable('Debió fallar por evento desconocido')
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorConfiguracion)
        expect((error as Error).message).toContain('eventoInventado')
      }
    })

    it('Sin hooks configurados', async () => {
      // WHEN el config no declara la clave hooks
      const dir = crearDir()
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Todo igual'] }],
      })
      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Hola')

      // THEN la sesión se comporta igual que sin esta capacidad
      expect(h.sesion.obtenerUltimoTurno()?.tipo).toBe('completado')
    })
  })

  describe('Requirement: El sistema ejecuta el hook con el contexto del evento', () => {
    it('preTool recibe la herramienta y sus argumentos, postTool recibe el resultado y sessionStart no recibe herramienta', async () => {
      const dir = crearDir()
      const payloads: Array<Record<string, unknown>> = []

      const gestor = new GestorHooks({
        directorioProyecto: dir,
        hooks: {
          sessionStart: [{ comando: 'test-session' }],
          preTool: [{ comando: 'test-pre' }],
          postTool: [{ comando: 'test-post' }],
        },
        ejecutorComando: async (_cmd, entradaJson) => {
          payloads.push(JSON.parse(entradaJson) as Record<string, unknown>)
          return { codigo: 0, stdout: '', stderr: '' }
        },
      })

      await gestor.ejecutar({ evento: 'sessionStart' })
      await gestor.ejecutar({
        evento: 'preTool',
        herramienta: 'read',
        argumentos: { ruta: 'a.ts' },
      })
      await gestor.ejecutar({
        evento: 'postTool',
        herramienta: 'read',
        argumentos: { ruta: 'a.ts' },
        resultado: '1: hola',
      })

      // sessionStart no incluye herramienta ni argumentos
      expect(payloads[0]).toEqual({ evento: 'sessionStart', proyecto: dir })
      expect(payloads[0]).not.toHaveProperty('herramienta')
      expect(payloads[0]).not.toHaveProperty('argumentos')

      // preTool incluye herramienta, argumentos y proyecto
      expect(payloads[1]).toEqual({
        evento: 'preTool',
        proyecto: dir,
        herramienta: 'read',
        argumentos: { ruta: 'a.ts' },
      })

      // postTool incluye resultado
      expect(payloads[2]).toEqual({
        evento: 'postTool',
        proyecto: dir,
        herramienta: 'read',
        argumentos: { ruta: 'a.ts' },
        resultado: '1: hola',
      })
    })

    it('Un hook que se cuelga', async () => {
      // WHEN un hook no termina dentro del timeout
      const dir = crearDir()
      const gestor = new GestorHooks({
        directorioProyecto: dir,
        timeoutMs: 25,
        hooks: {
          preTool: [{ comando: 'node -e "setTimeout(() => {}, 250)"' }],
        },
      })

      const res = await gestor.ejecutar({
        evento: 'preTool',
        herramienta: 'read',
        argumentos: { ruta: 'a.ts' },
      })

      // THEN el sistema lo corta, avisa y el turno continúa
      expect(res.bloqueado).toBe(false)
      expect(res.avisos[0]).toContain('timeout')
    })
  })

  describe('Requirement: El código de salida del hook decide', () => {
    it('Códigos 0 (aprueba), 1 (advierte), 2 (bloquea en preTool/postTool/sessionStart, avisa en turnEnd/sessionEnd) y código inesperado', async () => {
      const dir = crearDir()
      writeFileSync(join(dir, 'a.ts'), 'export const a = 1\n')

      // 1. Código 1 en postTool agrega nota visible y continúa
      const proveedor1 = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'c1', nombre: 'read', argumentos: { ruta: 'a.ts' } },
            ],
          },
          { fragmentosTexto: ['Leído con nota'] },
        ],
      })
      const h1 = construirHarness({
        directorioProyecto: dir,
        proveedor: proveedor1,
        reglasPermiso: [{ accion: 'hook', recurso: '*', efecto: 'permitir' }],
        hooks: {
          postTool: [{ comando: 'cmd-advierte' }],
        },
        ejecutorComandoHook: async () => ({
          codigo: 1,
          stdout: 'Nota de lint del hook',
          stderr: '',
        }),
      })
      await h1.sesion.enviarMensaje('Lee a.ts')
      const msgTool1 = h1.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(msgTool1?.resultado).toContain('export const a = 1')
      expect(msgTool1?.resultado).toContain('Nota de lint del hook')

      // 2. Código 2 en preTool impide ejecutar la herramienta y devuelve el mensaje como error de texto
      const proveedor2 = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'c2',
                nombre: 'write',
                argumentos: { ruta: 'bloqueado.ts', contenido: 'no' },
              },
            ],
          },
          { fragmentosTexto: ['No se escribió'] },
        ],
      })
      const h2 = construirHarness({
        directorioProyecto: dir,
        proveedor: proveedor2,
        reglasPermiso: [{ accion: 'hook', recurso: '*', efecto: 'permitir' }],
        hooks: {
          preTool: [{ comando: 'cmd-bloquea-pre' }],
        },
        ejecutorComandoHook: async () => ({
          codigo: 2,
          stdout: 'Bloqueado antes de escribir',
          stderr: '',
        }),
      })
      await h2.sesion.enviarMensaje('Escribe bloqueado.ts')
      const msgTool2 = h2.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(msgTool2?.resultado).toContain(
        'ERROR: Bloqueado antes de escribir',
      )

      // 3. Código 2 en postTool reemplaza el resultado por un error de texto
      const proveedor3 = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'c3', nombre: 'read', argumentos: { ruta: 'a.ts' } },
            ],
          },
          { fragmentosTexto: ['Resultado reemplazado'] },
        ],
      })
      const h3 = construirHarness({
        directorioProyecto: dir,
        proveedor: proveedor3,
        reglasPermiso: [{ accion: 'hook', recurso: '*', efecto: 'permitir' }],
        hooks: {
          postTool: [{ comando: 'cmd-bloquea-post' }],
        },
        ejecutorComandoHook: async () => ({
          codigo: 2,
          stdout: 'Falló chequeo posterior',
          stderr: '',
        }),
      })
      await h3.sesion.enviarMensaje('Lee a.ts')
      const msgTool3 = h3.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(msgTool3?.resultado).toContain('ERROR: Falló chequeo posterior')
      expect(msgTool3?.resultado).not.toContain('export const a = 1')

      // 4. Código 2 en sessionStart impide arrancar
      expect(() =>
        construirHarness({
          directorioProyecto: dir,
          proveedor: new ProveedorSimulado({ respuestas: [] }),
          reglasPermiso: [{ accion: 'hook', recurso: '*', efecto: 'permitir' }],
          hooks: {
            sessionStart: [
              {
                comando:
                  'node -e "process.stdout.write(\'Entorno inválido\'); process.exit(2)"',
              },
            ],
          },
        }),
      ).toThrow(ErrorBloqueoHook)

      // 5. Código 2 en turnEnd y sessionEnd se trata como aviso, y código inesperado (ej. 42) se trata como aviso
      const gestor = new GestorHooks({
        directorioProyecto: dir,
        hooks: {
          turnEnd: [{ comando: 'cmd-turn-end' }],
          sessionEnd: [{ comando: 'cmd-session-end' }],
          preTool: [{ comando: 'cmd-42' }],
        },
        ejecutorComando: async (cmd) => {
          if (cmd === 'cmd-42') {
            return { codigo: 42, stdout: 'Salida codigo 42', stderr: '' }
          }
          return { codigo: 2, stdout: 'Aviso al cerrar', stderr: '' }
        },
      })
      const resTurnEnd = await gestor.ejecutar({ evento: 'turnEnd' })
      expect(resTurnEnd.bloqueado).toBe(false)
      expect(resTurnEnd.avisos).toContain('Aviso al cerrar')

      const resSessionEnd = await gestor.ejecutar({ evento: 'sessionEnd' })
      expect(resSessionEnd.bloqueado).toBe(false)
      expect(resSessionEnd.avisos).toContain('Aviso al cerrar')

      const res42 = await gestor.ejecutar({
        evento: 'preTool',
        herramienta: 'read',
      })
      expect(res42.bloqueado).toBe(false)
      expect(res42.notas).toContain('Salida codigo 42')
    })
  })

  describe('Requirement: Un hook que falla no detiene la sesión', () => {
    it('Comando inexistente, salida gigante (>8 KiB truncada) y sanitización de credenciales', async () => {
      const dir = crearDir()
      const secreto = 'sk-hook-super-secret-98765'

      const gestorInexistente = new GestorHooks({
        directorioProyecto: dir,
        hooks: {
          preTool: [{ comando: 'comando_inexistente_xyz_999888' }],
        },
      })
      const resInex = await gestorInexistente.ejecutar({
        evento: 'preTool',
        herramienta: 'read',
      })
      expect(resInex.bloqueado).toBe(false)
      expect(resInex.avisos.length).toBeGreaterThan(0)

      const gestorGigante = new GestorHooks({
        directorioProyecto: dir,
        credenciales: [secreto],
        hooks: {
          preTool: [{ comando: 'cmd-gigante' }],
        },
        ejecutorComando: async () => ({
          codigo: 1,
          stdout: `Clave=${secreto} ${'Z'.repeat(10 * 1024)}`,
          stderr: '',
        }),
      })
      const resGigante = await gestorGigante.ejecutar({
        evento: 'preTool',
        herramienta: 'read',
      })
      expect(resGigante.avisos[0]).not.toContain(secreto)
      expect(resGigante.avisos[0]).toContain('[REDACTADO]')
      expect(resGigante.avisos[0]).toContain('Salida de hook truncada a 8 KiB')
    })
  })

  describe('Requirement: Los hooks respetan los permisos', () => {
    it('Sin reglas pide aprobación, permitir ejecuta sin preguntar, denegar omite con aviso y herramienta denegada no dispara preTool', async () => {
      const dir = crearDir()
      writeFileSync(join(dir, '.env'), 'SECRET=1\n')

      // 1. Sin reglas configuradas pide aprobación (consultar en REGLAS_BASE)
      let pidioAprobacionHook = false
      const porteroConsulta = new GestorPermisos({
        directorioProyecto: dir,
        esInteractivo: true,
        manejadorAprobacion: async (sol) => {
          if (sol.accion === 'hook') {
            pidioAprobacionHook = true
          }
          return 'una_vez'
        },
      })
      const gestorConsulta = new GestorHooks({
        directorioProyecto: dir,
        portero: porteroConsulta,
        hooks: { turnEnd: [{ comando: 'cmd-ok' }] },
        ejecutorComando: async () => ({ codigo: 0, stdout: '', stderr: '' }),
      })
      await gestorConsulta.ejecutar({ evento: 'turnEnd' })
      expect(pidioAprobacionHook).toBe(true)

      // 2. Regla denegar omite el hook con aviso
      let ejecutoDenegado = false
      const porteroDenegar = new GestorPermisos({
        directorioProyecto: dir,
        reglasGlobales: [
          { accion: 'hook', recurso: 'turnEnd', efecto: 'denegar' },
        ],
      })
      const gestorDenegar = new GestorHooks({
        directorioProyecto: dir,
        portero: porteroDenegar,
        hooks: { turnEnd: [{ comando: 'cmd-omitido' }] },
        ejecutorComando: async () => {
          ejecutoDenegado = true
          return { codigo: 0, stdout: '', stderr: '' }
        },
      })
      const resDenegado = await gestorDenegar.ejecutar({ evento: 'turnEnd' })
      expect(ejecutoDenegado).toBe(false)
      expect(resDenegado.avisos[0]).toContain('omitido')

      // 3. Una herramienta denegada por el portero no dispara preTool
      let preToolDisparado = false
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'r1', nombre: 'read', argumentos: { ruta: '.env' } },
            ],
          },
          { fragmentosTexto: ['Denegado'] },
        ],
      })
      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        reglasPermiso: [
          { accion: 'read', recurso: '*.env', efecto: 'denegar' },
          { accion: 'hook', recurso: '*', efecto: 'permitir' },
        ],
        hooks: {
          preTool: [{ comando: 'cmd-pre' }],
        },
        ejecutorComandoHook: async () => {
          preToolDisparado = true
          return { codigo: 0, stdout: '', stderr: '' }
        },
      })
      await h.sesion.enviarMensaje('Lee .env')
      expect(preToolDisparado).toBe(false)
    })
  })

  describe('Requirement: Los cinco eventos tienen su punto de disparo', () => {
    it('Cada evento se dispara una vez y un subagente dispara solo preTool y postTool', async () => {
      const dir = crearDir()
      writeFileSync(join(dir, 'info.ts'), 'export const info = 1\n')
      const disparados: string[] = []

      const proveedor = new ProveedorSimulado({
        respuestas: [
          // Padre delega a explore
          {
            llamadasHerramienta: [
              {
                id: 't1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'Revisa info.ts' },
              },
            ],
          },
          // Subagente lee info.ts
          {
            llamadasHerramienta: [
              { id: 'h1', nombre: 'read', argumentos: { ruta: 'info.ts' } },
            ],
          },
          { fragmentosTexto: ['Info revisada'] },
          { fragmentosTexto: ['Listo'] },
        ],
      })

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        reglasPermiso: [{ accion: 'hook', recurso: '*', efecto: 'permitir' }],
        hooks: {
          preTool: [{ comando: 'cmd-pre' }],
          postTool: [{ comando: 'cmd-post' }],
          turnEnd: [{ comando: 'cmd-turn-end' }],
          sessionEnd: [{ comando: 'cmd-session-end' }],
        },
        ejecutorComandoHook: async (_cmd, entradaJson) => {
          const payload = JSON.parse(entradaJson) as {
            evento: string
            herramienta?: string
          }
          disparados.push(
            payload.herramienta
              ? `${payload.evento}:${payload.herramienta}`
              : payload.evento,
          )
          return { codigo: 0, stdout: '', stderr: '' }
        },
      })

      await h.sesion.enviarMensaje('Ejecuta con subagente')
      await h.cerrar()

      // Padre dispara preTool:task, Hijo dispara preTool:read y postTool:read, Padre dispara postTool:task, turnEnd (solo padre), sessionEnd (solo padre)
      expect(disparados).toEqual([
        'preTool:task',
        'preTool:read',
        'postTool:read',
        'postTool:task',
        'turnEnd',
        'sessionEnd',
      ])
    })
  })
})
