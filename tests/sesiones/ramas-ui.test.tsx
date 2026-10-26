import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { render } from 'ink'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { AppInteractiva } from '../../src/interface/app-interactiva.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import {
  AlmacenSesiones,
  type SesionCargada,
} from '../../src/sesiones/index.js'

function crearAlmacen(directorio: string, ids: string[]): AlmacenSesiones {
  let indice = 0
  let fecha = 0
  const base = Date.parse('2026-10-26T10:00:00.000Z')
  return new AlmacenSesiones({
    directorioProyecto: directorio,
    ahora: () => new Date(base + ++fecha * 60_000),
    generarId: () => ids[indice++] ?? `sesion-${indice}`,
  })
}

function crearSesion(
  almacen: AlmacenSesiones,
  sesionInicial?: SesionCargada,
): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['respuesta'] }],
    }),
    registro: new RegistroHerramientas(),
    ventanaContexto: 20_000,
    almacen,
    ...(sesionInicial ? { sesionInicial } : {}),
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

describe('interface Specification Tests — ramas y búsqueda', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-ramas-ui-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  // Requirement: La interfaz permite crear una rama de la sesión activa
  // -------------------------------------------------------------------------
  describe('Requirement: La interfaz permite crear una rama de la sesión activa', () => {
    it('Crear una rama desde la interfaz', async () => {
      // WHEN el usuario ejecuta `/rama <n>` con un turno válido
      const almacen = crearAlmacen(tempDir, ['s1', 's2'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'uno' },
        { rol: 'assistant', contenido: 'r1' },
      ])
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'dos' },
        { rol: 'assistant', contenido: 'r2' },
      ])
      const sesion = crearSesion(almacen, almacen.cargar('s1'))
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/rama 1')
      await escribir('\r')

      const texto = salida()
      const activa = sesion.obtenerSesionId()
      const historial = sesion.obtenerEstado().historial
      app.unmount()

      // THEN la interfaz pasa a la sesión nueva y muestra un aviso
      expect(activa).toBe('s2')
      expect(texto).toContain('Rama creada: s2')
      expect(
        historial.some(
          (item) => item.tipo === 'usuario' && item.texto === 'uno',
        ),
      ).toBe(true)
      expect(
        historial.some(
          (item) => item.tipo === 'usuario' && item.texto === 'dos',
        ),
      ).toBe(false)
    })

    it('Un número de turno inválido', async () => {
      // WHEN el usuario ejecuta `/rama` sin un número válido
      const almacen = crearAlmacen(tempDir, ['s1'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      const sesion = crearSesion(almacen, almacen.cargar('s1'))
      const activa = sesion.obtenerSesionId()
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/rama x')
      await escribir('\r')

      const texto = salida()
      expect(sesion.obtenerSesionId()).toBe(activa)
      app.unmount()

      // THEN la interfaz muestra un error y conserva la sesión activa
      expect(texto).toContain('Uso: /rama')
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La interfaz permite buscar en las sesiones
  // -------------------------------------------------------------------------
  describe('Requirement: La interfaz permite buscar en las sesiones', () => {
    it('Buscar desde la interfaz', async () => {
      // WHEN el usuario ejecuta `/sesiones buscar <texto>` con coincidencias
      const almacen = crearAlmacen(tempDir, ['s1', 's2'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'hablemos de typescript' },
      ])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s2', 'completado', [
        { rol: 'user', contenido: 'otra cosa' },
      ])
      const sesion = crearSesion(almacen, almacen.cargar('s1'))
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/sesiones buscar typescript')
      await escribir('\r')

      const texto = salida()
      app.unmount()

      // THEN la interfaz muestra las sesiones encontradas con su fragmento
      expect(texto).toContain('Búsqueda: typescript')
      expect(texto).toContain('s1')
      expect(texto).toContain('coincidencia')
    })

    it('Búsqueda sin coincidencias', async () => {
      // WHEN el usuario busca un texto que no aparece en ninguna sesión
      const almacen = crearAlmacen(tempDir, ['s1'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'hablemos de typescript' },
      ])
      const sesion = crearSesion(almacen, almacen.cargar('s1'))
      const { app, salida, escribir } = abrirInterfaz(sesion)

      await escribir('/sesiones buscar javascript')
      await escribir('\r')

      const texto = salida()
      app.unmount()

      // THEN la interfaz muestra que no hay coincidencias
      expect(texto).toContain('Sin coincidencias')
    })
  })
})
