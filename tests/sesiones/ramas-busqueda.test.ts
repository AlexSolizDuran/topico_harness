import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AlmacenSesiones } from '../../src/sesiones/almacen.js'

function crearAlmacen(
  directorio: string,
  ids: string[],
  maximo?: number,
): AlmacenSesiones {
  let indice = 0
  let fecha = 0
  const base = Date.parse('2026-10-26T10:00:00.000Z')
  return new AlmacenSesiones({
    directorioProyecto: directorio,
    ...(maximo !== undefined ? { maximo } : {}),
    ahora: () => new Date(base + ++fecha * 60_000),
    generarId: () => ids[indice++] ?? `sesion-${indice}`,
  })
}

describe('sesiones Specification Tests — ramas y búsqueda', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-ramas-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  // Requirement: Una sesión se puede ramificar desde un turno anterior
  // -------------------------------------------------------------------------
  describe('Requirement: Una sesión se puede ramificar desde un turno anterior', () => {
    it('Ramificar desde un turno existente', () => {
      // WHEN el usuario pide una rama desde un turno que existe en la sesión activa
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

      const rama = almacen.ramificar('s1', 1)

      // THEN se crea una sesión nueva con el historial hasta ese turno y la original queda intacta
      expect(rama.metadata.id).toBe('s2')
      expect(rama.metadata.padre).toBe('s1')
      expect(rama.metadata.desdeTurno).toBe(1)
      expect(rama.mensajes.map((mensaje) => mensaje.contenido)).toEqual([
        'uno',
        'r1',
      ])
      expect(almacen.cargar('s1').mensajes).toHaveLength(4)
    })

    it('Ramificar desde antes del primer turno', () => {
      // WHEN el usuario pide una rama desde el turno cero
      const almacen = crearAlmacen(tempDir, ['s1', 's2'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'uno' },
      ])

      const rama = almacen.ramificar('s1', 0)

      // THEN la sesión nueva arranca sin historial
      expect(rama.mensajes).toEqual([])
      expect(rama.metadata.desdeTurno).toBe(0)
      expect(rama.metadata.mensajes).toBe(0)
    })

    it('Ramificar desde un turno inexistente', () => {
      // WHEN el usuario pide una rama desde un turno que la sesión no tiene
      const almacen = crearAlmacen(tempDir, ['s1', 's2'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'uno' },
      ])

      // THEN el sistema no crea la rama y devuelve un error
      expect(() => almacen.ramificar('s1', 5)).toThrow(/no tiene/)
      expect(almacen.listar().map((sesion) => sesion.id)).toEqual(['s1'])
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Se puede buscar texto en las sesiones guardadas
  // -------------------------------------------------------------------------
  describe('Requirement: Se puede buscar texto en las sesiones guardadas', () => {
    it('Buscar un texto presente', () => {
      // WHEN el usuario busca un texto que aparece en una o más sesiones
      const almacen = crearAlmacen(tempDir, ['s1', 's2'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'hablemos de typescript' },
      ])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s2', 'completado', [
        { rol: 'user', contenido: 'otra cosa' },
      ])

      const resultados = almacen.buscar('typescript')

      // THEN recibe esas sesiones con la cantidad de coincidencias y un fragmento
      expect(resultados).toHaveLength(1)
      expect(resultados[0]?.sesion.id).toBe('s1')
      expect(resultados[0]?.coincidencias).toBe(1)
      expect(resultados[0]?.fragmento).toContain('typescript')
    })

    it('Buscar un texto ausente', () => {
      // WHEN el usuario busca un texto que no aparece en ninguna sesión
      const almacen = crearAlmacen(tempDir, ['s1'])
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno('s1', 'completado', [
        { rol: 'user', contenido: 'hablemos de typescript' },
      ])

      // THEN recibe una lista vacía
      expect(almacen.buscar('javascript')).toEqual([])
    })

    it('Buscar con texto vacío', () => {
      // WHEN el usuario busca sin texto
      const almacen = crearAlmacen(tempDir, ['s1'])

      // THEN recibe un mensaje de error
      expect(() => almacen.buscar('   ')).toThrow(/vacío/)
    })
  })
})
