import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { render, renderToString } from 'ink'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { BarraEstado } from '../../src/interface/app.js'
import { AppInteractiva } from '../../src/interface/app-interactiva.js'
import { formatearAvisoSesion } from '../../src/interface/plain.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { crearEstadoInicial } from '../../src/interface/state.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { AlmacenSesiones } from '../../src/sesiones/almacen.js'

function crearSesion(
  almacen: AlmacenSesiones,
  respuestas: ConstructorParameters<typeof ProveedorSimulado>[0] = {},
): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['respuesta'] }],
      ...respuestas,
    }),
    registro: new RegistroHerramientas(),
    ventanaContexto: 20_000,
    almacen,
  })
}

function abrirInterfaz(sesion: SesionInteractiva) {
  const stdin = new PassThrough()
  Object.assign(stdin, {
    isTTY: true,
    setRawMode: () => {},
    ref: () => {},
    unref: () => {},
  })
  const stdout = new PassThrough()
  const partes: string[] = []
  stdout.on('data', (parte) => partes.push(String(parte)))
  Object.assign(stdout, { columns: 120, rows: 40 })

  const app = render(<AppInteractiva sesion={sesion} />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    debug: true,
    patchConsole: false,
    exitOnCtrlC: false,
  })

  return {
    app,
    salida: () => partes.join(''),
    escribir: async (texto: string) => {
      stdin.write(texto)
      await app.waitUntilRenderFlush()
    },
  }
}

describe('interface Specification Tests — sesiones', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-sesiones-ui-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  // Requirement: La interfaz permite listar, cargar y crear sesiones
  // -------------------------------------------------------------------------
  describe('Requirement: La interfaz permite listar, cargar y crear sesiones', () => {
    it('El usuario lista las sesiones', async () => {
      // WHEN el usuario ejecuta el comando de listado
      let indice = 0
      const almacen = new AlmacenSesiones({
        directorioProyecto: tempDir,
        generarId: () => `sesion-${++indice}`,
      })
      const sesion = crearSesion(almacen)
      const primera = sesion.obtenerSesionId() as string
      const segunda = sesion.nuevaSesion()
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/sesiones')
      await escribir('\r')
      const texto = salida()
      app.unmount()

      // THEN la interfaz muestra las sesiones con identificador, fecha, modelo y cantidad de mensajes
      expect(texto).toContain(primera)
      expect(texto).toContain(segunda)
      expect(texto).toContain('mensajes')
    })

    it('El usuario carga una sesión', async () => {
      // WHEN el usuario ejecuta el comando de carga con un identificador válido
      let indice = 0
      const almacen = new AlmacenSesiones({
        directorioProyecto: tempDir,
        generarId: () => `sesion-${++indice}`,
      })
      const sesion = crearSesion(almacen)
      const primera = sesion.obtenerSesionId() as string
      await sesion.enviarMensaje('pedido guardado')
      sesion.nuevaSesion()
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir(`/sesiones ${primera}`)
      await escribir('\r')
      const texto = salida()
      app.unmount()

      // THEN la interfaz muestra el historial restaurado de esa sesión
      expect(texto).toContain(`Sesión activa: ${primera}`)
      expect(
        sesion
          .obtenerEstado()
          .historial.some(
            (item) =>
              item.tipo === 'usuario' && item.texto === 'pedido guardado',
          ),
      ).toBe(true)
    })

    it('El usuario crea una sesión nueva', async () => {
      // WHEN el usuario ejecuta el comando de sesión nueva
      let indice = 0
      const almacen = new AlmacenSesiones({
        directorioProyecto: tempDir,
        generarId: () => `sesion-${++indice}`,
      })
      const sesion = crearSesion(almacen)
      const anterior = sesion.obtenerSesionId() as string
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/nueva')
      await escribir('\r')
      const texto = salida()
      const nueva = sesion.obtenerSesionId()
      app.unmount()

      // THEN la interfaz queda sin historial y lista para un pedido nuevo
      expect(nueva).not.toBe(anterior)
      expect(texto).toContain('Sesión nueva')
      expect(
        sesion
          .obtenerEstado()
          .historial.filter((item) => item.tipo !== 'aviso'),
      ).toHaveLength(0)
    })

    it('No se cambia de sesión durante un turno', async () => {
      // WHEN el usuario pide cambiar de sesión mientras hay un turno en curso
      let indice = 0
      const almacen = new AlmacenSesiones({
        directorioProyecto: tempDir,
        generarId: () => `sesion-${++indice}`,
      })
      const sesion = crearSesion(almacen)
      const activa = sesion.obtenerSesionId() as string
      const { app, salida, escribir } = abrirInterfaz(sesion)
      sesion.obtenerEstado().turnoEnCurso = true

      await escribir('/nueva')
      await escribir('\r')
      const texto = salida()
      sesion.obtenerEstado().turnoEnCurso = false
      app.unmount()

      // THEN la interfaz rechaza el cambio y el turno continúa
      expect(texto).toContain('No se puede crear una sesión')
      expect(sesion.obtenerSesionId()).toBe(activa)
    })

    it('Un identificador inválido no cambia la sesión', async () => {
      // WHEN el usuario pide cargar una sesión que no existe
      let indice = 0
      const almacen = new AlmacenSesiones({
        directorioProyecto: tempDir,
        generarId: () => `sesion-${++indice}`,
      })
      const sesion = crearSesion(almacen)
      const activa = sesion.obtenerSesionId()
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/sesiones no-existe')
      await escribir('\r')
      const texto = salida()
      app.unmount()

      // THEN la interfaz muestra el error y conserva la sesión activa
      expect(texto).toContain('no existe')
      expect(sesion.obtenerSesionId()).toBe(activa)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La interfaz muestra la sesión activa
  // -------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra la sesión activa', () => {
    it('La barra de estado muestra la sesión', () => {
      // WHEN hay una sesión activa guardada
      const estado = crearEstadoInicial(
        '',
        'openrouter/openai/gpt-4o',
        undefined,
        'build',
        {
          sesionId: 'sesion-1',
        },
      )

      // THEN la barra de estado muestra su identificador
      expect(renderToString(<BarraEstado estado={estado} />)).toContain(
        'ses sesion-1',
      )
    })

    it('El modo línea a línea informa la sesión', () => {
      // WHEN se inicia o reanuda una sesión sin terminal no interactiva
      const { sesion } = construirHarness({
        directorioProyecto: tempDir,
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        config: { proveedores: {} },
        esInteractivo: false,
      })

      // THEN la salida informa el identificador de la sesión activa
      const id = sesion.obtenerSesionId()
      expect(id).toBeDefined()
      expect(formatearAvisoSesion(id)).toBe(`[Sesión: ${id}]\n`)
    })
  })
})
