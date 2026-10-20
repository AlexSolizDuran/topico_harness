import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, win32 } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  crearHerramientaEdicion,
  crearHerramientaGlob,
  crearHerramientaGrep,
  crearHerramientaLectura,
  detectarEol,
  ErrorRutaInvalida,
  normalizarEol,
  resolverRutaSegura,
  restaurarEol,
} from '../../src/tools/index.js'

describe('Portabilidad de herramientas', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-portabilidad-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  describe('Fin de línea', () => {
    it('detecta y restaura CRLF', () => {
      const texto = 'a\r\nb\r\nc\r\n'
      expect(detectarEol(texto)).toBe('\r\n')
      expect(normalizarEol(texto)).toBe('a\nb\nc\n')
      expect(restaurarEol('a\nb\n', '\r\n')).toBe('a\r\nb\r\n')
    })

    it('lee un tramo de un archivo CRLF sin arrastrar el retorno', async () => {
      writeFileSync(
        join(tempDir, 'crlf.txt'),
        'Linea 1\r\nLinea 2\r\nLinea 3\r\n',
        'utf-8',
      )
      const toolRead = crearHerramientaLectura(tempDir)

      const tramo = await toolRead.ejecutar({
        ruta: 'crlf.txt',
        inicio: 1,
        fin: 2,
      })

      expect(tramo).toBe('Linea 1\nLinea 2')
    })

    it('grepea un archivo CRLF sin retorno al final de la línea', async () => {
      const toolGrep = crearHerramientaGrep(tempDir)
      const res = await toolGrep.ejecutar({ cadena: 'Linea 2' })

      expect(res).toContain('crlf.txt:2: Linea 2')
      expect(res).not.toContain('\r')
    })

    it('edita un archivo CRLF con una búsqueda LF y conserva CRLF', async () => {
      writeFileSync(
        join(tempDir, 'editar-crlf.txt'),
        'uno\r\ndos\r\ntres\r\n',
        'utf-8',
      )
      const toolEdit = crearHerramientaEdicion(tempDir)

      await toolEdit.ejecutar({
        ruta: 'editar-crlf.txt',
        buscar: 'dos\n',
        reemplazar: 'DOS\n',
      })

      const contenido = readFileSync(join(tempDir, 'editar-crlf.txt'), 'utf-8')
      expect(contenido).toBe('uno\r\nDOS\r\ntres\r\n')
    })
  })

  describe('Rutas de Windows', () => {
    it('acepta una ruta dentro del proyecto', () => {
      const ruta = resolverRutaSegura('C:\\proy\\src\\a.ts', 'C:\\proy', win32)
      expect(ruta).toBe('C:\\proy\\src\\a.ts')
    })

    it('rechaza una ruta fuera del proyecto', () => {
      expect(() =>
        resolverRutaSegura('C:\\otro\\a.ts', 'C:\\proy', win32),
      ).toThrow(ErrorRutaInvalida)
    })

    it('rechaza un .. que sale del proyecto', () => {
      expect(() =>
        resolverRutaSegura('..\\..\\etc\\passwd', 'C:\\proy\\sub', win32),
      ).toThrow(ErrorRutaInvalida)
    })

    it('tolera separadores mezclados', () => {
      const ruta = resolverRutaSegura('C:/proy/src\\a.ts', 'C:\\proy', win32)
      expect(ruta).toBe('C:\\proy\\src\\a.ts')
    })

    it('compara sin distinguir mayúsculas', () => {
      const ruta = resolverRutaSegura('C:\\Proy\\a.ts', 'c:\\proy', win32)
      expect(ruta.toLowerCase()).toContain('c:\\proy\\a.ts')
    })
  })

  describe('Rutas protegidas', () => {
    it('no lee el archivo .env', async () => {
      writeFileSync(join(tempDir, '.env'), 'CLAVE_ENV=secreto', 'utf-8')
      const toolRead = crearHerramientaLectura(tempDir)

      await expect(toolRead.ejecutar({ ruta: '.env' })).rejects.toThrow(
        ErrorRutaInvalida,
      )
    })

    it('no lee el config local del harness', async () => {
      mkdirSync(join(tempDir, '.harness'), { recursive: true })
      writeFileSync(
        join(tempDir, '.harness', 'config.json'),
        '{"apiKey":"secreto"}',
        'utf-8',
      )
      const toolRead = crearHerramientaLectura(tempDir)

      await expect(
        toolRead.ejecutar({ ruta: '.harness/config.json' }),
      ).rejects.toThrow(ErrorRutaInvalida)
    })

    it('grep no recorre .env ni .harness', async () => {
      const toolGrep = crearHerramientaGrep(tempDir)
      const res = await toolGrep.ejecutar({ cadena: 'CLAVE_ENV' })

      expect(res).not.toContain('.env:1')
      expect(res).toContain('No se encontraron coincidencias')
    })
  })

  describe('Búsqueda', () => {
    it('glob ignora node_modules', async () => {
      mkdirSync(join(tempDir, 'node_modules', 'paquete'), { recursive: true })
      writeFileSync(
        join(tempDir, 'node_modules', 'paquete', 'x.ts'),
        '',
        'utf-8',
      )
      writeFileSync(join(tempDir, 'propio.ts'), '', 'utf-8')
      const toolGlob = crearHerramientaGlob(tempDir)

      const res = await toolGlob.ejecutar({ patron: '*.ts' })

      expect(res).toContain('propio.ts')
      expect(res).not.toContain('node_modules')
    })
  })
})
