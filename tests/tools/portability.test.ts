import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
  evaluarRiesgoRuta,
  motivoAprobacionRuta,
  normalizarEol,
  resolverRuta,
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
    it('Separador invertido en Windows', () => {
      // WHEN el modelo pide un archivo con separador / y la plataforma usa \
      const ruta = resolverRuta('C:/proy/src/a.ts', 'C:\\proy', win32)
      // THEN el sistema lo encuentra igual
      expect(ruta).toBe('C:\\proy\\src\\a.ts')
    })

    it('tolera separadores mezclados', () => {
      const ruta = resolverRuta('C:/proy/src\\a.ts', 'C:\\proy', win32)
      expect(ruta).toBe('C:\\proy\\src\\a.ts')
    })

    it('compara sin distinguir mayúsculas', () => {
      const ruta = resolverRuta('C:\\Proy\\a.ts', 'c:\\proy', win32)
      expect(ruta.toLowerCase()).toContain('c:\\proy\\a.ts')
    })

    it('La ruta sale del proyecto', () => {
      // WHEN el modelo pide un archivo fuera del directorio del proyecto
      const riesgo = evaluarRiesgoRuta('C:\\otro\\a.ts', 'C:\\proy', win32)
      const motivo = motivoAprobacionRuta('C:\\otro\\a.ts', 'C:\\proy', win32)

      // THEN el sistema pide aprobación obligatoria y muestra la ruta
      expect(riesgo.fueraDelProyecto).toBe(true)
      expect(motivo).toContain('C:\\otro\\a.ts')
    })

    it('un .. que sale del proyecto pide aprobación', () => {
      const motivo = motivoAprobacionRuta(
        '..\\..\\etc\\passwd',
        'C:\\proy\\sub',
        win32,
      )
      expect(motivo).toContain('fuera del proyecto')
    })
  })

  describe('Rutas sensibles', () => {
    it('Un archivo .env', async () => {
      writeFileSync(join(tempDir, '.env'), 'CLAVE_ENV=secreto', 'utf-8')
      const toolRead = crearHerramientaLectura(tempDir)

      // THEN el sistema pide aprobación obligatoria y nombra la ruta
      expect(
        toolRead.motivoAprobacionObligatoria?.({ ruta: '.env' }),
      ).toContain('.env')
      // La ejecución ya no rechaza: el portero decide antes.
      await expect(toolRead.ejecutar({ ruta: '.env' })).resolves.toContain(
        'CLAVE_ENV',
      )
    })

    it('Un archivo .env.local', () => {
      const toolRead = crearHerramientaLectura(tempDir)
      expect(
        toolRead.motivoAprobacionObligatoria?.({ ruta: '.env.local' }),
      ).toBeDefined()
    })

    it('El config local del harness', () => {
      const toolRead = crearHerramientaLectura(tempDir)
      expect(
        toolRead.motivoAprobacionObligatoria?.({
          ruta: '.harness/config.json',
        }),
      ).toBeDefined()
    })

    it('Un archivo .env.example', () => {
      const toolRead = crearHerramientaLectura(tempDir)
      expect(
        toolRead.motivoAprobacionObligatoria?.({ ruta: '.env.example' }),
      ).toBeUndefined()
    })

    it('Una ruta interna común no pide aprobación', () => {
      const toolRead = crearHerramientaLectura(tempDir)
      expect(
        toolRead.motivoAprobacionObligatoria?.({ ruta: 'src/a.ts' }),
      ).toBeUndefined()
    })

    it('Un symlink que sale del proyecto', () => {
      const externo = mkdtempSync(join(tmpdir(), 'harness-externo-'))
      try {
        writeFileSync(join(externo, 'a.ts'), 'x', 'utf-8')
        symlinkSync(externo, join(tempDir, 'enlace'), 'junction')
        // WHEN la ruta está dentro pero el symlink la resuelve fuera
        const motivo = motivoAprobacionRuta('enlace/a.ts', tempDir)
        // THEN el sistema pide aprobación obligatoria
        expect(motivo).toContain('fuera del proyecto')
      } finally {
        rmSync(join(tempDir, 'enlace'), { recursive: true, force: true })
        rmSync(externo, { recursive: true, force: true })
      }
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
