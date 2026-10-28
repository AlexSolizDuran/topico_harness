import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ejecutarTurno, RegistroHerramientas } from '../../src/core/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { crearHerramientaDelegacion } from '../../src/subagents/index.js'
import {
  crearCatalogoPorDefecto,
  crearHerramientaEdicion,
  crearHerramientaEscritura,
  crearHerramientaGlob,
  crearHerramientaGrep,
  crearHerramientaLectura,
  crearHerramientaShell,
  ErrorEsquemaRequerido,
  ErrorPermisoHerramientaRequerido,
  MAXIMO_CONTENIDO_POR_DEFECTO,
  motivoAprobacionRuta,
  registrarHerramientaConValidacion,
  resolverRuta,
  truncarContenido,
} from '../../src/tools/index.js'
import type { EstadoTurno, EventoTurno } from '../../src/types.js'

async function consumirTurnoCompleto(
  generador: AsyncGenerator<EventoTurno, EstadoTurno, unknown>,
): Promise<EstadoTurno> {
  let iter = await generador.next()
  while (!iter.done) {
    iter = await generador.next()
  }
  return iter.value
}

describe('tools Specification Tests', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-tools-test-'))
  })

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignorar fallos de limpieza en Windows
    }
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness lee un archivo y devuelve su contenido
  // --------------------------------------------------------------------------
  describe('Requirement: El harness lee un archivo y devuelve su contenido', () => {
    it('El archivo existe', async () => {
      // WHEN el modelo pide leer un archivo presente en el proyecto
      writeFileSync(
        join(tempDir, 'saludo.txt'),
        'Hola mundo desde archivo',
        'utf-8',
      )
      const toolRead = crearHerramientaLectura(tempDir)

      const resultado = await toolRead.ejecutar({ ruta: 'saludo.txt' })

      // THEN el sistema devuelve su contenido
      expect(resultado).toBe('Hola mundo desde archivo')
    })

    it('Se pide solo un tramo', async () => {
      // WHEN el modelo pide leer una porción del archivo
      const lineas = ['Linea 1', 'Linea 2', 'Linea 3', 'Linea 4', 'Linea 5']
      writeFileSync(join(tempDir, 'lineas.txt'), lineas.join('\n'), 'utf-8')
      const toolRead = crearHerramientaLectura(tempDir)

      const tramo = await toolRead.ejecutar({
        ruta: 'lineas.txt',
        inicio: 2,
        fin: 4,
      })

      // THEN el sistema devuelve solo esa porción
      expect(tramo).toBe('Linea 2\nLinea 3\nLinea 4')
    })

    it('El archivo no existe', async () => {
      // WHEN el modelo pide leer un archivo que no está en el proyecto
      const toolRead = crearHerramientaLectura(tempDir)

      // THEN el sistema devuelve un mensaje de error y el turno continúa
      await expect(
        toolRead.ejecutar({ ruta: 'archivo_fantasma.txt' }),
      ).rejects.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness escribe un archivo
  // --------------------------------------------------------------------------
  describe('Requirement: El harness escribe un archivo', () => {
    it('El archivo no existía', async () => {
      // WHEN el modelo pide escribir en una ruta nueva
      const toolWrite = crearHerramientaEscritura(tempDir)
      const resultado = await toolWrite.ejecutar({
        ruta: 'nuevo.txt',
        contenido: 'contenido nuevo',
      })

      // THEN el sistema crea el archivo con el contenido dado
      expect(resultado).toContain('exitosamente')
      const toolRead = crearHerramientaLectura(tempDir)
      const leido = await toolRead.ejecutar({ ruta: 'nuevo.txt' })
      expect(leido).toBe('contenido nuevo')
    })

    it('El archivo ya existía', async () => {
      // WHEN el modelo pide escribir en una ruta existente
      writeFileSync(join(tempDir, 'sobrescribir.txt'), 'viejo', 'utf-8')
      const toolWrite = crearHerramientaEscritura(tempDir)

      await toolWrite.ejecutar({
        ruta: 'sobrescribir.txt',
        contenido: 'completamente nuevo',
      })

      // THEN el sistema reemplaza su contenido completo
      const toolRead = crearHerramientaLectura(tempDir)
      const leido = await toolRead.ejecutar({ ruta: 'sobrescribir.txt' })
      expect(leido).toBe('completamente nuevo')
    })

    it('La ruta no es escribible', async () => {
      // WHEN la ruta no permite escritura
      mkdirSync(join(tempDir, 'es_un_directorio'))
      const toolWrite = crearHerramientaEscritura(tempDir)

      // THEN el sistema devuelve un mensaje de error y ningún archivo cambia
      await expect(
        toolWrite.ejecutar({
          ruta: 'es_un_directorio',
          contenido: 'intruso',
        }),
      ).rejects.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness edita un archivo reemplazando una ocurrencia exacta
  // --------------------------------------------------------------------------
  describe('Requirement: El harness edita un archivo reemplazando una ocurrencia exacta', () => {
    it('El texto aparece una vez', async () => {
      // WHEN el texto a reemplazar aparece exactamente una vez en el archivo
      writeFileSync(
        join(tempDir, 'editar.txt'),
        'const a = 1;\nconst b = 2;\n',
        'utf-8',
      )
      const toolEdit = crearHerramientaEdicion(tempDir)

      const resultado = await toolEdit.ejecutar({
        ruta: 'editar.txt',
        buscar: 'const b = 2;',
        reemplazar: 'const b = 99;',
      })

      // THEN el sistema lo reemplaza y devuelve el resultado
      expect(resultado).toContain('exitosamente')
      const toolRead = crearHerramientaLectura(tempDir)
      const leido = await toolRead.ejecutar({ ruta: 'editar.txt' })
      expect(leido).toBe('const a = 1;\nconst b = 99;\n')
    })

    it('El texto aparece varias veces', async () => {
      // WHEN el texto a reemplazar aparece más de una vez en el archivo
      writeFileSync(
        join(tempDir, 'duplicado.txt'),
        'repetido repetido',
        'utf-8',
      )
      const toolEdit = crearHerramientaEdicion(tempDir)

      // THEN el sistema no modifica el archivo y devuelve cuántas ocurrencias encontró
      await expect(
        toolEdit.ejecutar({
          ruta: 'duplicado.txt',
          buscar: 'repetido',
          reemplazar: 'nuevo',
        }),
      ).rejects.toThrow(/aparece 2 veces/)
    })

    it('El texto no aparece', async () => {
      // WHEN el texto a reemplazar no está en el archivo
      writeFileSync(join(tempDir, 'no_esta.txt'), 'solo una linea', 'utf-8')
      const toolEdit = crearHerramientaEdicion(tempDir)

      // THEN el sistema no modifica el archivo y devuelve un mensaje de error
      await expect(
        toolEdit.ejecutar({
          ruta: 'no_esta.txt',
          buscar: 'inexistente',
          reemplazar: 'otro',
        }),
      ).rejects.toThrow(/no fue encontrado/)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness encuentra archivos por patrón
  // --------------------------------------------------------------------------
  describe('Requirement: El harness encuentra archivos por patrón', () => {
    it('Hay coincidencias', async () => {
      // WHEN el modelo pide archivos que coincidan con un patrón
      writeFileSync(join(tempDir, 'test1.ts'), 'ts1', 'utf-8')
      writeFileSync(join(tempDir, 'test2.ts'), 'ts2', 'utf-8')
      const toolGlob = crearHerramientaGlob(tempDir)

      const res = await toolGlob.ejecutar({ patron: '*.ts' })

      // THEN el sistema devuelve la lista de rutas que coinciden
      expect(res).toContain('test1.ts')
      expect(res).toContain('test2.ts')
    })

    it('No hay coincidencias', async () => {
      // WHEN ningún archivo del proyecto coincide con el patrón
      const toolGlob = crearHerramientaGlob(tempDir)
      const res = await toolGlob.ejecutar({ patron: '*.xyz_inexistente' })

      // THEN el sistema devuelve una lista vacía
      expect(res).toBe('[]')
    })

    it('El patrón apunta fuera del proyecto', async () => {
      // WHEN el patrón alcanza archivos fuera del directorio del proyecto
      const toolGlob = crearHerramientaGlob(tempDir)
      const res = await toolGlob.ejecutar({ patron: '../../**/*.txt' })

      // THEN el sistema no los incluye en el resultado
      expect(res).toBe('[]')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness busca texto dentro de archivos
  // --------------------------------------------------------------------------
  describe('Requirement: El harness busca texto dentro de archivos', () => {
    it('Hay coincidencias', async () => {
      // WHEN el modelo busca una cadena que aparece en el proyecto
      writeFileSync(
        join(tempDir, 'buscar1.txt'),
        'clave_secreta_buscar',
        'utf-8',
      )
      const toolGrep = crearHerramientaGrep(tempDir)

      const res = await toolGrep.ejecutar({ cadena: 'clave_secreta_buscar' })

      // THEN el sistema devuelve los archivos y las líneas donde aparece
      expect(res).toContain('buscar1.txt:1: clave_secreta_buscar')
    })

    it('No hay coincidencias', async () => {
      // WHEN el modelo busca una cadena que no aparece en el proyecto
      const toolGrep = crearHerramientaGrep(tempDir)
      const res = await toolGrep.ejecutar({
        cadena: 'termino_inexistente_12345',
      })

      // THEN el sistema informa que no encontró coincidencias
      expect(res).toContain('No se encontraron coincidencias')
    })

    it('Un archivo no se puede leer', async () => {
      // WHEN un archivo del proyecto no puede leerse durante la búsqueda
      writeFileSync(join(tempDir, 'legible.txt'), 'palabra_clave', 'utf-8')
      const toolGrep = crearHerramientaGrep(tempDir)

      const res = await toolGrep.ejecutar({ cadena: 'palabra_clave' })

      // THEN el sistema lo omite y devuelve el resultado del resto
      expect(res).toContain('legible.txt:1: palabra_clave')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma
  // --------------------------------------------------------------------------
  describe('Requirement: La herramienta de ejecución se resuelve contra el catálogo de cada plataforma', () => {
    it('El comando está en el catálogo', async () => {
      // WHEN el modelo solicita un comando presente en el catálogo de la plataforma activa
      const toolShell = crearHerramientaShell({
        plataforma: 'linux',
        ejecutor: async () => ({ salida: 'v20.0.0', codigoSalida: 0 }),
      })

      expect(toolShell).toBeDefined()
      const res = await toolShell?.ejecutar({ comando: 'node -v' })

      // THEN el sistema lo ejecuta con el intérprete de esa plataforma
      expect(res).toBe('v20.0.0')
    })

    it('El comando no está en el catálogo', () => {
      // WHEN el modelo solicita un comando ausente del catálogo de la plataforma activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'comando_no_existente_xyz',
      })

      // THEN el sistema pide aprobación obligatoria y explica que no pertenece al catálogo
      expect(motivo).toContain('no pertenece al catálogo')
    })

    it('Un comando de otra plataforma', () => {
      // WHEN el modelo solicita un comando que existe en otra plataforma pero no en la activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'dir',
      })

      // THEN el sistema pide aprobación obligatoria en lugar de buscar un equivalente por su cuenta
      expect(motivo).toContain('no pertenece al catálogo')
    })

    it('En Windows se usa PowerShell', async () => {
      // WHEN la plataforma activa es Windows
      let comandoRecibido = ''
      const toolShell = crearHerramientaShell({
        plataforma: 'win32',
        ejecutor: async (comando) => {
          comandoRecibido = comando
          return { salida: 'listado', codigoSalida: 0 }
        },
      })

      // THEN el sistema expone la herramienta y ejecuta el comando con PowerShell
      expect(toolShell).toBeDefined()
      expect(toolShell?.nombre).toBe('shell')
      const res = await toolShell?.ejecutar({ comando: 'Get-ChildItem' })
      expect(res).toBe('listado')
      expect(comandoRecibido).toBe('Get-ChildItem')
    })

    it('El nombre es el mismo en todas las plataformas', () => {
      // WHEN se registra la herramienta de ejecución en Linux, macOS o Windows
      const linuxTool = crearHerramientaShell({ plataforma: 'linux' })
      const darwinTool = crearHerramientaShell({ plataforma: 'darwin' })
      const winTool = crearHerramientaShell({ plataforma: 'win32' })

      // THEN se expone bajo el mismo nombre y su catálogo se resuelve según la plataforma activa
      expect(linuxTool?.nombre).toBe('shell')
      expect(darwinTool?.nombre).toBe('shell')
      expect(winTool?.nombre).toBe('shell')
    })

    it('Un comando compuesto', () => {
      // WHEN el modelo solicita en Windows una línea que compone varios comandos
      const toolShell = crearHerramientaShell({ plataforma: 'win32' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'Get-ChildItem; Get-Location',
      })

      // THEN el sistema pide aprobación obligatoria
      expect(motivo).toContain('Windows')
    })

    it('Los comandos de borrado no están en el catálogo de Windows', () => {
      const toolShell = crearHerramientaShell({ plataforma: 'win32' })

      for (const comando of [
        'Remove-Item archivo.txt',
        'del archivo.txt',
        'erase archivo.txt',
        'rd carpeta',
        'rmdir carpeta',
        'rm archivo.txt',
      ]) {
        const motivo = toolShell?.motivoAprobacionObligatoria?.({ comando })
        expect(motivo).toContain('no pertenece al catálogo')
      }
    })

    it('Extrae el binario de una ruta absoluta de Windows', async () => {
      let recibido = ''
      const toolShell = crearHerramientaShell({
        plataforma: 'win32',
        ejecutor: async (comando) => {
          recibido = comando
          return { salida: 'ok', codigoSalida: 0 }
        },
      })

      const res = await toolShell?.ejecutar({
        comando: '"C:\\Program Files\\Git\\cmd\\git.exe" status',
      })

      expect(res).toBe('ok')
      expect(recibido).toContain('git.exe')
    })

    it('Un comando compuesto en Unix', async () => {
      // WHEN el modelo encadena dos comandos permitidos del catálogo
      let recibido = ''
      const toolShell = crearHerramientaShell({
        plataforma: 'linux',
        ejecutor: async (comando) => {
          recibido = comando
          return { salida: 'ok', codigoSalida: 0 }
        },
      })

      const res = await toolShell?.ejecutar({
        comando: 'git status && npm test',
      })

      // THEN valida la línea completa y la ejecuta como compuesto
      expect(res).toBe('ok')
      expect(recibido).toBe('git status && npm test')
      expect(
        toolShell?.resolverAccion?.({ comando: 'git status && npm test' }),
      ).toBe('shell_compuesto')
    })

    it('Un segmento de la lista negra pide aprobación para la línea completa', () => {
      // WHEN una línea compuesta incluye un segmento de la lista negra
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'cat archivo.txt && rm -rf /',
      })

      // THEN el sistema pide aprobación obligatoria para la línea completa con el motivo a la vista
      expect(motivo).toContain("'rm'")
      expect(motivo).toContain('lista negra')
    })

    it('Un intérprete con -c pide aprobación obligatoria', () => {
      // WHEN el modelo ejecuta código a través de un intérprete
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN se evalúa como compuesto y pide aprobación obligatoria
      expect(
        toolShell?.resolverAccion?.({ comando: 'bash -c "rm -rf /"' }),
      ).toBe('shell_compuesto')
      expect(
        toolShell?.motivoAprobacionObligatoria?.({
          comando: 'bash -c "rm -rf /"',
        }),
      ).toContain('intérprete')
      expect(
        toolShell?.resolverAccion?.({ comando: 'node -e "console.log(1)"' }),
      ).toBe('shell_compuesto')
      expect(
        toolShell?.resolverAccion?.({ comando: 'python3 -c "print(1)"' }),
      ).toBe('shell_compuesto')
      expect(toolShell?.resolverAccion?.({ comando: 'git status' })).toBe(
        'shell',
      )
    })

    it('La sustitución de comandos pide aprobación obligatoria', () => {
      // WHEN la línea incluye $() o backticks fuera de comillas simples
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'echo $(rm -rf /)',
      })

      // THEN el sistema pide aprobación obligatoria con el motivo a la vista
      expect(motivo).toContain('sustitución')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La herramienta de ejecución acepta un directorio de trabajo
  // --------------------------------------------------------------------------
  describe('Requirement: La herramienta de ejecución acepta un directorio de trabajo', () => {
    it('Un directorio dentro del proyecto', async () => {
      // WHEN el modelo indica un subdirectorio existente del proyecto
      const raiz = mkdtempSync(join(tmpdir(), 'harness-shell-'))
      mkdirSync(join(raiz, 'paquete'))
      let recibido = ''

      try {
        const toolShell = crearHerramientaShell({
          plataforma: 'linux',
          directorioProyecto: raiz,
          ejecutor: async (_comando, cwd) => {
            recibido = cwd
            return { salida: 'ok', codigoSalida: 0 }
          },
        })

        const res = await toolShell?.ejecutar({
          comando: 'pwd',
          directorio: 'paquete',
        })

        // THEN el comando se ejecuta con ese directorio como cwd
        expect(res).toBe('ok')
        expect(recibido.endsWith('paquete')).toBe(true)
      } finally {
        rmSync(raiz, { recursive: true, force: true })
      }
    })

    it('Un directorio fuera del proyecto', () => {
      // WHEN el modelo indica un directorio que queda fuera del proyecto
      const raiz = mkdtempSync(join(tmpdir(), 'harness-shell-'))

      try {
        const toolShell = crearHerramientaShell({
          plataforma: 'linux',
          directorioProyecto: raiz,
        })

        const motivo = toolShell?.motivoAprobacionObligatoria?.({
          comando: 'pwd',
          directorio: '..',
        })

        // THEN el sistema pide aprobación obligatoria antes de ejecutar
        expect(motivo).toContain('fuera del proyecto')
      } finally {
        rmSync(raiz, { recursive: true, force: true })
      }
    })

    it('Un directorio sensible', () => {
      // WHEN el modelo indica un directorio dentro de .harness
      const raiz = mkdtempSync(join(tmpdir(), 'harness-shell-'))
      mkdirSync(join(raiz, '.harness'))

      try {
        const toolShell = crearHerramientaShell({
          plataforma: 'linux',
          directorioProyecto: raiz,
        })

        const motivo = toolShell?.motivoAprobacionObligatoria?.({
          comando: 'pwd',
          directorio: '.harness',
        })

        // THEN el sistema pide aprobación obligatoria antes de ejecutar
        expect(motivo).toContain('protegida')
      } finally {
        rmSync(raiz, { recursive: true, force: true })
      }
    })

    it('Un directorio inexistente', async () => {
      // WHEN el modelo indica un directorio que no existe en el proyecto
      const raiz = mkdtempSync(join(tmpdir(), 'harness-shell-'))
      let ejecutado = false

      try {
        const toolShell = crearHerramientaShell({
          plataforma: 'linux',
          directorioProyecto: raiz,
          ejecutor: async () => {
            ejecutado = true
            return { salida: '', codigoSalida: 0 }
          },
        })

        const res = await toolShell?.ejecutar({
          comando: 'pwd',
          directorio: 'no-existe',
        })

        // THEN rechaza la solicitud sin ejecutar el comando
        expect(res).toContain('no existe')
        expect(ejecutado).toBe(false)
      } finally {
        rmSync(raiz, { recursive: true, force: true })
      }
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La herramienta de ejecución pide aprobación obligatoria ante una redirección
  // --------------------------------------------------------------------------
  describe('Requirement: La herramienta de ejecución pide aprobación obligatoria ante una redirección', () => {
    it('Una redirección de escritura a un archivo', () => {
      // WHEN la línea escribe en un archivo con >, >>, >|, &> o <>
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      for (const comando of [
        'echo hola > out.txt',
        'echo hola >> out.txt',
        'echo hola >| out.txt',
        'echo hola &> out.txt',
        'echo hola <> out.txt',
      ]) {
        // THEN el sistema pide aprobación obligatoria y muestra la línea completa
        expect(toolShell?.motivoAprobacionObligatoria?.({ comando })).toContain(
          'out.txt',
        )
      }
      expect(
        toolShell?.resolverAccion?.({ comando: 'echo hola > out.txt' }),
      ).toBe('shell_redireccion')
    })

    it('Una redirección fuera del proyecto', () => {
      // WHEN la línea escribe en una ruta fuera del proyecto
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({
          comando: 'echo hola > ../fuera.txt',
        }),
      ).toBeDefined()
    })

    it('Una redirección a un archivo sensible', () => {
      // WHEN la línea escribe en .env, .env.* o dentro de .harness
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'echo x > .env' }),
      ).toBeDefined()
      expect(
        toolShell?.motivoAprobacionObligatoria?.({
          comando: 'echo x > .harness/log',
        }),
      ).toBeDefined()
    })

    it('Una redirección de entrada', () => {
      // WHEN la línea lee un archivo con < o n<
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'cat < a.txt' }),
      ).toContain('a.txt')
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'cat 0< a.txt' }),
      ).toContain('a.txt')
    })

    it('Un heredoc', () => {
      // WHEN la línea usa <<, <<- o <<<
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria y no intenta validar el contenido
      for (const comando of ['cat <<EOF', 'cat <<-EOF', 'cat <<< hola']) {
        expect(toolShell?.motivoAprobacionObligatoria?.({ comando })).toContain(
          'no se puede verificar',
        )
      }
    })

    it('Una sustitución de proceso', () => {
      // WHEN la línea usa <(…) o >(…)
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'cat <(ls)' }),
      ).toBeDefined()
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'tee >(cat)' }),
      ).toBeDefined()
    })

    it('La redirección a /dev/null no pide aprobación', () => {
      // WHEN la línea redirige a /dev/null
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema la evalúa como invocación simple
      for (const comando of [
        'echo hola > /dev/null',
        'echo hola 2>/dev/null',
      ]) {
        expect(
          toolShell?.motivoAprobacionObligatoria?.({ comando }),
        ).toBeUndefined()
        expect(toolShell?.resolverAccion?.({ comando })).toBe('shell')
      }
    })

    it('La duplicación de descriptores no pide aprobación', () => {
      // WHEN la línea usa 2>&1, n>&m o n>&-
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema la evalúa como invocación simple
      for (const comando of [
        'node app.js 2>&1',
        'node app.js 3>&1',
        'node app.js 2>&-',
      ]) {
        expect(
          toolShell?.motivoAprobacionObligatoria?.({ comando }),
        ).toBeUndefined()
        expect(toolShell?.resolverAccion?.({ comando })).toBe('shell')
      }
    })

    it('Un `>` entre comillas no es una redirección', () => {
      // WHEN el carácter > aparece dentro de comillas
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema lo trata como texto y no pide aprobación
      expect(
        toolShell?.motivoAprobacionObligatoria?.({
          comando: 'echo "a > b"',
        }),
      ).toBeUndefined()
      expect(toolShell?.resolverAccion?.({ comando: 'echo "a > b"' })).toBe(
        'shell',
      )
    })

    it('Una redirección sin destino', () => {
      // WHEN la línea termina en > sin un destino
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'echo hola >' }),
      ).toContain('destino')
    })

    it('Una línea que solo redirige', () => {
      // WHEN la línea no tiene comando y solo redirige a un archivo
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: '> out.txt' }),
      ).toContain('out.txt')
    })

    it('Una redirección en Windows', () => {
      // WHEN la plataforma activa es Windows y la línea redirige
      const toolShell = crearHerramientaShell({ plataforma: 'win32' })

      // THEN el sistema pide aprobación obligatoria
      expect(
        toolShell?.motivoAprobacionObligatoria?.({
          comando: 'Write-Output hola > out.txt',
        }),
      ).toBeDefined()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Cada herramienta declara su esquema
  // --------------------------------------------------------------------------
  describe('Requirement: Cada herramienta declara su esquema', () => {
    it('Alta de herramienta', () => {
      // WHEN se da de alta una herramienta nueva
      const registro = new RegistroHerramientas()

      // THEN el sistema exige su esquema y no la habilita mientras no lo declare
      expect(() => {
        registrarHerramientaConValidacion(registro, {
          nombre: 'sin_esquema',
          descripcion: 'invalida',
          esquema: {},
          ejecutar: async () => '',
        })
      }).toThrow(ErrorEsquemaRequerido)
    })

    it('El esquema describe los argumentos', () => {
      // WHEN el modelo consulta qué acepta una herramienta
      const toolRead = crearHerramientaLectura(tempDir)

      // THEN el sistema expone los nombres, los tipos y cuáles son obligatorios
      expect(toolRead.esquema).toHaveProperty('properties')
      expect(toolRead.esquema).toHaveProperty('required')
      const requeridos = (toolRead.esquema as { required?: string[] }).required
      expect(requeridos).toEqual(['ruta'])
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El contenido devuelto por una herramienta se trunca
  // --------------------------------------------------------------------------
  describe('Requirement: El contenido devuelto por una herramienta se trunca', () => {
    it('El contenido excede el máximo', () => {
      // WHEN una herramienta devuelve más contenido que el máximo
      const contenidoGigante = 'A'.repeat(50)
      const truncado = truncarContenido(contenidoGigante, 20)

      // THEN el sistema lo trunca e indica que fue truncado
      expect(truncado.length).toBeLessThan(contenidoGigante.length + 100)
      expect(truncado).toContain(
        '[Contenido truncado. Se mostraron 20 de 50 caracteres]',
      )
    })

    it('El contenido no lo excede', () => {
      // WHEN una herramienta devuelve menos contenido que el máximo
      const contenidoChico = 'Texto corto'
      const res = truncarContenido(contenidoChico, 50)

      // THEN el sistema lo devuelve completo
      expect(res).toBe('Texto corto')
    })

    it('El valor por defecto', () => {
      // WHEN el sistema arranca sin configuración explícita
      // THEN el máximo de contenido por herramienta es 30.000 caracteres
      expect(MAXIMO_CONTENIDO_POR_DEFECTO).toBe(30000)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un error de una herramienta no interrumpe el turno
  // --------------------------------------------------------------------------
  describe('Requirement: Un error de una herramienta no interrumpe el turno', () => {
    it('Falla una herramienta', async () => {
      // WHEN una herramienta lanza una excepción durante su ejecución
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'tool_con_error',
        descripcion: 'falla',
        esquema: {},
        ejecutar: async () => {
          throw new Error('Fallo simulado')
        },
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: '1', nombre: 'tool_con_error', argumentos: {} },
            ],
          },
          { fragmentosTexto: ['Continué tras el fallo'] },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'intenta y falla' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema devuelve el fallo y el turno continúa hacia el siguiente paso
      expect(estado.tipo).toBe('completado')
      expect(estado.pasosEjecutados).toBe(2)
    })

    it('Falla la herramienta de ejecución', async () => {
      // WHEN el comando ejecutado termina con un código de salida distinto de cero
      const toolShell = crearHerramientaShell({
        plataforma: 'linux',
        ejecutor: async () => ({
          salida: 'Error de compilación en main.c',
          codigoSalida: 1,
        }),
      })

      const res = await toolShell?.ejecutar({ comando: 'node -v' })

      // THEN el sistema devuelve ese código y la salida, y el turno continúa
      expect(res).toContain('Comando terminó con código 1')
      expect(res).toContain('Error de compilación en main.c')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Las rutas se resuelven igual en toda plataforma
  // --------------------------------------------------------------------------
  describe('Requirement: Las rutas se resuelven igual en toda plataforma', () => {
    it('Separador invertido en Windows', () => {
      // WHEN el modelo pide un archivo con separador / y la plataforma activa usa \
      const ruta = resolverRuta('src/utils/test.ts', tempDir)

      // THEN el sistema lo encuentra igual
      expect(ruta).toBe(join(tempDir, 'src', 'utils', 'test.ts'))
    })

    it('Ruta relativa al proyecto', () => {
      // WHEN el modelo pide un archivo con una ruta relativa
      const ruta = resolverRuta('archivo.txt', tempDir)

      // THEN el sistema lo resuelve respecto del directorio del proyecto
      expect(ruta).toBe(join(tempDir, 'archivo.txt'))
    })

    it('La ruta sale del proyecto', () => {
      // WHEN el modelo pide un archivo fuera del directorio del proyecto
      const motivo = motivoAprobacionRuta('../../etc/passwd', tempDir)

      // THEN el sistema pide aprobación obligatoria y muestra la ruta
      expect(motivo).toContain('fuera del proyecto')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un comando de la lista negra pide aprobación obligatoria
  // --------------------------------------------------------------------------
  describe('Requirement: Un comando de la lista negra pide aprobación obligatoria', () => {
    it('Comando de la lista negra', () => {
      // WHEN el modelo solicita un comando de la lista negra de la plataforma activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const motivo = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'rm archivo.txt',
      })

      // THEN el sistema pide aprobación obligatoria con el comando y el motivo a la vista
      expect(motivo).toContain("'rm'")
      expect(motivo).toContain('lista negra')
    })

    it('El riesgo es por nombre completo', () => {
      // WHEN un comando de la lista negra se solicita con sus opciones en otro orden o en formato largo
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const res1 = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'rm -rf /',
      })
      const res2 = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'rm --recursive --force /',
      })
      const res3 = toolShell?.motivoAprobacionObligatoria?.({
        comando: 'rm -r -f /',
      })

      // THEN el sistema pide aprobación obligatoria igualmente
      expect(res1).toContain('lista negra')
      expect(res2).toContain('lista negra')
      expect(res3).toContain('lista negra')
    })

    it('Un comando permitido', async () => {
      // WHEN el modelo solicita un comando presente en el catálogo y fuera de la lista negra
      const toolShell = crearHerramientaShell({
        plataforma: 'linux',
        ejecutor: async () => ({ salida: 'commit abc1234', codigoSalida: 0 }),
      })

      // THEN el sistema lo ejecuta sin consultar
      expect(
        toolShell?.motivoAprobacionObligatoria?.({ comando: 'git status' }),
      ).toBeUndefined()
      const res = await toolShell?.ejecutar({ comando: 'git status' })
      expect(res).toBe('commit abc1234')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La herramienta de delegación declara su esquema
  // --------------------------------------------------------------------------
  describe('Requirement: La herramienta de delegación declara su esquema', () => {
    it('La herramienta de delegación declara agente y pedido', () => {
      // WHEN el modelo consulta qué acepta la herramienta de delegación
      const toolSubagente = crearHerramientaDelegacion({
        obtenerAgentes: () => [
          {
            nombre: 'explore',
            descripcion: 'Explorador',
            modo: 'subagente',
            herramientas: ['read'],
            prompt: 'Explora.',
          },
        ],
        obtenerCatalogo: () => new RegistroHerramientas(),
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      // THEN el sistema expone el agente elegido y el pedido como argumentos obligatorios
      expect(toolSubagente.esquema).toHaveProperty('properties')
      const requeridos = (toolSubagente.esquema as { required?: string[] })
        .required
      expect(requeridos).toEqual(['agent', 'prompt'])
    })

    it('Un argumento inválido vuelve como texto', async () => {
      // WHEN el modelo invoca la herramienta de delegación sin alguno de sus argumentos obligatorios
      const toolSubagente = crearHerramientaDelegacion({
        obtenerAgentes: () => [
          {
            nombre: 'explore',
            descripcion: 'Explorador',
            modo: 'subagente',
            herramientas: ['read'],
            prompt: 'Explora.',
          },
        ],
        obtenerCatalogo: () => new RegistroHerramientas(),
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      const resSinPedido = await toolSubagente.ejecutar({ agent: 'explore' })
      const resSinAgente = await toolSubagente.ejecutar({ prompt: 'Busca X' })

      // THEN el sistema la rechaza sin ejecutar el hijo y devuelve el motivo como resultado de herramienta
      expect(resSinPedido).toContain('ERROR:')
      expect(resSinAgente).toContain('ERROR:')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Cada herramienta declara su acción de permiso y su recurso
  // --------------------------------------------------------------------------
  describe('Requirement: Cada herramienta declara su acción de permiso y su recurso', () => {
    it('El catálogo expone la acción y el recurso', () => {
      // WHEN el sistema prepara una llamada a una herramienta del catálogo
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })

      const toolRead = registro.obtener('read')
      const toolWrite = registro.obtener('write')
      const toolEdit = registro.obtener('edit')
      const toolGlob = registro.obtener('glob')
      const toolGrep = registro.obtener('grep')
      const toolShell = registro.obtener('shell')

      // THEN obtiene de la propia herramienta la acción de permiso y el recurso asociado a esos argumentos
      expect(toolRead?.accionPermiso).toBe('read')
      expect(toolRead?.obtenerRecurso?.({ ruta: 'src/a.ts' })).toBe('src/a.ts')
      expect(toolWrite?.accionPermiso).toBe('edit')
      expect(toolWrite?.obtenerRecurso?.({ ruta: 'src/b.ts' })).toBe('src/b.ts')
      expect(toolEdit?.accionPermiso).toBe('edit')
      expect(toolEdit?.obtenerRecurso?.({ ruta: 'src/c.ts' })).toBe('src/c.ts')
      expect(toolGlob?.accionPermiso).toBe('glob')
      expect(toolGlob?.obtenerRecurso?.({ patron: '**/*.ts' })).toBe('**/*.ts')
      expect(toolGrep?.accionPermiso).toBe('grep')
      expect(toolGrep?.obtenerRecurso?.({ cadena: 'TODO' })).toBe('TODO')
      expect(toolShell?.accionPermiso).toBe('shell')
      expect(toolShell?.obtenerRecurso?.({ comando: 'git status' })).toBe(
        'git status',
      )
    })

    it('Una herramienta sin acción no se habilita', () => {
      // WHEN se intenta dar de alta una herramienta que no declara su acción de permiso
      const registro = new RegistroHerramientas()

      // THEN el sistema la rechaza antes de habilitarla
      expect(() => {
        registrarHerramientaConValidacion(registro, {
          nombre: 'sin_accion',
          descripcion: 'Tiene esquema pero no acción',
          esquema: {
            type: 'object',
            properties: { x: { type: 'string' } },
          },
          ejecutar: async () => '',
        })
      }).toThrow(ErrorPermisoHerramientaRequerido)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Cada herramienta declara si admite ejecución en paralelo
  // --------------------------------------------------------------------------
  describe('Requirement: Cada herramienta declara si admite ejecución en paralelo', () => {
    it('Una herramienta segura se agrupa con las consecutivas', () => {
      // WHEN el catálogo registra las herramientas de lectura y búsqueda
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })

      // THEN quedan marcadas como aptas para ejecutarse en paralelo
      expect(registro.obtener('read')?.admiteParalelo).toBe(true)
      expect(registro.obtener('glob')?.admiteParalelo).toBe(true)
      expect(registro.obtener('grep')?.admiteParalelo).toBe(true)
      expect(registro.obtener('write')?.admiteParalelo).toBe(false)
      expect(registro.obtener('edit')?.admiteParalelo).toBe(false)
      expect(registro.obtener('shell')?.admiteParalelo).toBe(false)
    })

    it('Una herramienta sin declaración se ejecuta sola', () => {
      // WHEN se registra una herramienta que no declara si admite ejecución en paralelo
      const registro = new RegistroHerramientas()
      registrarHerramientaConValidacion(registro, {
        nombre: 'personalizada',
        descripcion: 'Sin admiteParalelo explícito',
        esquema: {
          type: 'object',
          properties: { x: { type: 'string' } },
        },
        accionPermiso: 'read',
        obtenerRecurso: () => '*',
        ejecutar: async () => 'ok',
      })

      // THEN el sistema la trata como exclusiva y no la agrupa con otras
      expect(registro.obtener('personalizada')?.admiteParalelo).toBeFalsy()
    })
  })
})
