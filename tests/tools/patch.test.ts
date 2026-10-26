import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agruparLlamadasEnTandas } from '../../src/core/index.js'
import {
  crearCatalogoPorDefecto,
  crearHerramientaParche,
} from '../../src/tools/index.js'

function parche(...lineas: string[]): string {
  return ['*** Begin Patch', ...lineas, '*** End Patch'].join('\n')
}

describe('tools Specification Tests — apply_patch', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-patch-test-'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignorar fallos de limpieza en Windows
    }
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness aplica un parche compuesto por bloques de intención
  // --------------------------------------------------------------------------
  describe('Requirement: El harness aplica un parche compuesto por bloques de intención', () => {
    it('Un parche agrega un archivo', async () => {
      // WHEN el parche contiene un bloque de alta con su contenido
      const herramienta = crearHerramientaParche(tempDir)
      const resultado = await herramienta.ejecutar({
        patch: parche('*** Add File: nuevo.txt', '+uno', '+dos'),
      })

      // THEN el sistema crea el archivo con ese contenido y lo informa en el resultado
      expect(readFileSync(join(tempDir, 'nuevo.txt'), 'utf-8')).toBe(
        'uno\ndos\n',
      )
      expect(resultado).toContain('nuevo.txt')
    })

    it('Un parche actualiza un archivo', async () => {
      // WHEN el parche contiene un bloque de actualización con líneas a quitar y a poner
      writeFileSync(
        join(tempDir, 'nota.txt'),
        'linea 1\nlinea 2\nlinea 3\n',
        'utf-8',
      )
      const herramienta = crearHerramientaParche(tempDir)
      await herramienta.ejecutar({
        patch: parche(
          '*** Update File: nota.txt',
          '@@',
          ' linea 1',
          '-linea 2',
          '+linea dos',
          ' linea 3',
        ),
      })

      // THEN el sistema modifica el archivo y lo informa en el resultado
      expect(readFileSync(join(tempDir, 'nota.txt'), 'utf-8')).toBe(
        'linea 1\nlinea dos\nlinea 3\n',
      )
    })

    it('Un parche borra un archivo', async () => {
      // WHEN el parche contiene un bloque de borrado de un archivo existente
      writeFileSync(join(tempDir, 'viejo.txt'), 'contenido', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)
      const resultado = await herramienta.ejecutar({
        patch: parche('*** Delete File: viejo.txt'),
      })

      // THEN el sistema elimina el archivo y lo informa en el resultado
      expect(existsSync(join(tempDir, 'viejo.txt'))).toBe(false)
      expect(resultado).toContain('viejo.txt')
    })

    it('Un parche sin bloques no modifica nada', async () => {
      // WHEN el modelo envía un parche vacío o sin bloques reconocibles
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el sistema no modifica archivos y devuelve un mensaje de error
      await expect(herramienta.ejecutar({ patch: parche() })).rejects.toThrow(
        /ningún bloque/,
      )
      expect(existsSync(join(tempDir, 'nuevo.txt'))).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El parche se valida completo antes de escribir
  // --------------------------------------------------------------------------
  describe('Requirement: El parche se valida completo antes de escribir', () => {
    it('Un bloque inválido deja el resto intacto', async () => {
      // WHEN un parche tiene un bloque válido y otro cuya actualización no coincide
      writeFileSync(join(tempDir, 'nota.txt'), 'original\n', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)

      // THEN ningún archivo se modifica y el error identifica el bloque que falló
      await expect(
        herramienta.ejecutar({
          patch: parche(
            '*** Add File: nuevo.txt',
            '+contenido',
            '*** Update File: nota.txt',
            '@@',
            '-no existe',
            '+reemplazo',
          ),
        }),
      ).rejects.toThrow(/nota\.txt/)
      expect(existsSync(join(tempDir, 'nuevo.txt'))).toBe(false)
      expect(readFileSync(join(tempDir, 'nota.txt'), 'utf-8')).toBe(
        'original\n',
      )
    })

    it('Una ruta fuera del proyecto se rechaza', async () => {
      // WHEN un bloque apunta fuera del directorio del proyecto
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el parche completo se rechaza y ningún archivo se modifica
      await expect(
        herramienta.ejecutar({
          patch: parche('*** Add File: ../fuera.txt', '+contenido'),
        }),
      ).rejects.toThrow(/fuera del proyecto/)
      expect(existsSync(join(tempDir, '..', 'fuera.txt'))).toBe(false)
    })

    it('Agregar un archivo que ya existe falla', async () => {
      // WHEN un bloque declara agregar una ruta que ya existe
      writeFileSync(join(tempDir, 'existente.txt'), 'previo', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el parche completo se rechaza y el archivo existente no cambia
      await expect(
        herramienta.ejecutar({
          patch: parche('*** Add File: existente.txt', '+otro'),
        }),
      ).rejects.toThrow(/ya existe/)
      expect(readFileSync(join(tempDir, 'existente.txt'), 'utf-8')).toBe(
        'previo',
      )
    })

    it('Borrar un archivo inexistente falla', async () => {
      // WHEN un bloque declara borrar una ruta que no existe
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el parche completo se rechaza y ningún archivo cambia
      await expect(
        herramienta.ejecutar({
          patch: parche('*** Delete File: no-existe.txt'),
        }),
      ).rejects.toThrow(/no existe/)
      expect(existsSync(join(tempDir, 'no-existe.txt'))).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La actualización por bloques exige una coincidencia única
  // --------------------------------------------------------------------------
  describe('Requirement: La actualización por bloques exige una coincidencia única', () => {
    it('La secuencia aparece una vez', async () => {
      // WHEN las líneas del bloque aparecen exactamente una vez en el archivo
      writeFileSync(join(tempDir, 'unico.txt'), 'a\nb\nc\n', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)
      await herramienta.ejecutar({
        patch: parche('*** Update File: unico.txt', '@@', '-b', '+B'),
      })

      // THEN el sistema aplica el cambio en ese lugar
      expect(readFileSync(join(tempDir, 'unico.txt'), 'utf-8')).toBe(
        'a\nB\nc\n',
      )
    })

    it('La secuencia aparece varias veces', async () => {
      // WHEN las líneas del bloque aparecen más de una vez en el archivo
      writeFileSync(join(tempDir, 'repetido.txt'), 'x\nx\n', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el sistema no modifica el archivo e informa cuántas coincidencias encontró
      await expect(
        herramienta.ejecutar({
          patch: parche('*** Update File: repetido.txt', '@@', '-x', '+y'),
        }),
      ).rejects.toThrow(/2 coincidencias/)
      expect(readFileSync(join(tempDir, 'repetido.txt'), 'utf-8')).toBe(
        'x\nx\n',
      )
    })

    it('La secuencia no aparece', async () => {
      // WHEN las líneas del bloque no aparecen en el archivo
      writeFileSync(join(tempDir, 'otro.txt'), 'a\nb\n', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)

      // THEN el sistema no modifica el archivo y devuelve un mensaje de error
      await expect(
        herramienta.ejecutar({
          patch: parche('*** Update File: otro.txt', '@@', '-z', '+Z'),
        }),
      ).rejects.toThrow(/no encontró/)
      expect(readFileSync(join(tempDir, 'otro.txt'), 'utf-8')).toBe('a\nb\n')
    })

    it('El fin de línea original se conserva', async () => {
      // WHEN el archivo usa un fin de línea distinto del nativo de la plataforma
      writeFileSync(join(tempDir, 'crlf.txt'), 'uno\r\ndos\r\n', 'utf-8')
      const herramienta = crearHerramientaParche(tempDir)
      await herramienta.ejecutar({
        patch: parche('*** Update File: crlf.txt', '@@', '-dos', '+tres'),
      })

      // THEN el archivo actualizado conserva su fin de línea original
      const contenido = readFileSync(join(tempDir, 'crlf.txt'), 'utf-8')
      expect(contenido).toBe('uno\r\ntres\r\n')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El parche declara su permiso y no admite ejecución en paralelo
  // --------------------------------------------------------------------------
  describe('Requirement: El parche declara su permiso y no admite ejecución en paralelo', () => {
    it('El catálogo expone las rutas del parche', () => {
      // WHEN el sistema prepara una llamada a la herramienta de parche
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const herramienta = registro.obtener('apply_patch')
      const patch = parche(
        '*** Add File: a.txt',
        '+a',
        '*** Update File: b.txt',
        '@@',
        '-b',
        '+B',
      )

      // THEN obtiene de la propia herramienta la acción de edición y todas las rutas declaradas
      expect(herramienta?.accionPermiso).toBe('edit')
      expect(herramienta?.obtenerRecurso?.({ patch })).toEqual([
        'a.txt',
        'b.txt',
      ])
    })

    it('El parche no se agrupa en una tanda', () => {
      // WHEN el modelo pide un parche junto a otras herramientas en la misma tanda
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const tandas = agruparLlamadasEnTandas(
        [
          { id: '1', nombre: 'read', argumentos: { ruta: 'a.txt' } },
          {
            id: '2',
            nombre: 'apply_patch',
            argumentos: { patch: parche('*** Delete File: a.txt') },
          },
          { id: '3', nombre: 'read', argumentos: { ruta: 'b.txt' } },
        ],
        registro,
      )

      // THEN el parche se ejecuta solo, sin compartir tanda con las demás
      expect(
        tandas.map((tanda) => tanda.map((llamada) => llamada.nombre)),
      ).toEqual([['read'], ['apply_patch'], ['read']])
    })
  })
})
