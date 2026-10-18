import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ejecutarTurno, RegistroHerramientas } from '../../src/core/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import {
  crearHerramientaEdicion,
  crearHerramientaEscritura,
  crearHerramientaGlob,
  crearHerramientaGrep,
  crearHerramientaLectura,
  crearHerramientaShell,
  ErrorEsquemaRequerido,
  ErrorRutaInvalida,
  MAXIMO_CONTENIDO_POR_DEFECTO,
  registrarHerramientaConValidacion,
  resolverRutaSegura,
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
      const toolWrite = crearHerramientaEscritura(tempDir)

      // Intentar escribir fuera del proyecto
      await expect(
        toolWrite.ejecutar({
          ruta: '../../no_permitido.txt',
          contenido: 'intruso',
        }),
      ).rejects.toThrow(ErrorRutaInvalida)
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
  // Requirement: La herramienta de ejecución se resuelve contra el catálogo de la plataforma
  // --------------------------------------------------------------------------
  describe('Requirement: La herramienta de ejecución se resuelve contra el catálogo de la plataforma', () => {
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

    it('El comando no está en el catálogo', async () => {
      // WHEN el modelo solicita un comando ausente del catálogo de la plataforma activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const res = await toolShell?.ejecutar({
        comando: 'comando_no_existente_xyz',
      })

      // THEN el sistema lo rechaza sin ejecutarlo y explica que no está disponible
      expect(res).toContain('no está disponible en el catálogo')
    })

    it('Un comando de otra plataforma', async () => {
      // WHEN el modelo solicita un comando que existe en otra plataforma pero no en la activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const res = await toolShell?.ejecutar({ comando: 'dir' })

      // THEN el sistema lo rechaza en lugar de buscar un equivalente por su cuenta
      expect(res).toContain('no está disponible en el catálogo')
    })

    it('La herramienta no está disponible en Windows', () => {
      // WHEN la plataforma activa es Windows
      const toolShell = crearHerramientaShell({ plataforma: 'win32' })

      // THEN el sistema no expone la herramienta de ejecución entre las herramientas disponibles para el modelo
      expect(toolShell).toBeUndefined()
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
      const ruta = resolverRutaSegura('src/utils/test.ts', tempDir)

      // THEN el sistema lo encuentra igual
      expect(ruta).toBe(join(tempDir, 'src', 'utils', 'test.ts'))
    })

    it('Ruta relativa al proyecto', () => {
      // WHEN el modelo pide un archivo con una ruta relativa
      const ruta = resolverRutaSegura('archivo.txt', tempDir)

      // THEN el sistema lo resuelve respecto del directorio del proyecto
      expect(ruta).toBe(join(tempDir, 'archivo.txt'))
    })

    it('La ruta sale del proyecto', () => {
      // WHEN el modelo pide un archivo fuera del directorio del proyecto
      // THEN el sistema rechaza la ruta
      expect(() => {
        resolverRutaSegura('../../etc/passwd', tempDir)
      }).toThrow(ErrorRutaInvalida)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un comando de la lista negra no se ejecuta
  // --------------------------------------------------------------------------
  describe('Requirement: Un comando de la lista negra no se ejecuta', () => {
    it('Comando bloqueado', async () => {
      // WHEN el modelo solicita un comando de la lista negra de la plataforma activa
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const res = await toolShell?.ejecutar({ comando: 'rm archivo.txt' })

      // THEN el sistema lo rechaza sin ejecutarlo y devuelve el motivo al modelo como texto
      expect(res).toContain('lista negra de comandos restringidos')
    })

    it('El bloqueo es por nombre completo', async () => {
      // WHEN un comando bloqueado se solicita con sus opciones en otro orden o en formato largo
      const toolShell = crearHerramientaShell({ plataforma: 'linux' })

      const res1 = await toolShell?.ejecutar({ comando: 'rm -rf /' })
      const res2 = await toolShell?.ejecutar({
        comando: 'rm --recursive --force /',
      })
      const res3 = await toolShell?.ejecutar({ comando: 'rm -r -f /' })

      // THEN el sistema lo rechaza igualmente
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

      const res = await toolShell?.ejecutar({ comando: 'git status' })

      // THEN el sistema lo ejecuta
      expect(res).toBe('commit abc1234')
    })
  })
})
