import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  despacharHerramienta,
  ErrorHistorialInvalido,
  ejecutarTurno,
  LIMITE_PASOS_POR_DEFECTO,
  RegistroHerramientas,
} from '../../src/core/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import type {
  EstadoTurno,
  EventoProveedor,
  EventoTurno,
  Mensaje,
} from '../../src/types.js'

async function consumirTurnoCompleto(
  generador: AsyncGenerator<EventoTurno, EstadoTurno, unknown>,
): Promise<EstadoTurno> {
  let iter = await generador.next()
  while (!iter.done) {
    iter = await generador.next()
  }
  return iter.value
}

describe('core Specification Tests', () => {
  // --------------------------------------------------------------------------
  // Requirement: El bucle itera hasta que el modelo termina sin pedir más herramientas
  // --------------------------------------------------------------------------
  describe('Requirement: El bucle itera hasta que el modelo termina sin pedir más herramientas', () => {
    it('Una tarea de varios pasos se completa', async () => {
      // WHEN el usuario pide agregar una prueba para una función y el modelo lee, busca, edita y ejecuta la prueba
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee archivo',
        esquema: {},
        ejecutar: async () => 'codigo_fuente',
      })
      registro.registrar({
        nombre: 'edit',
        descripcion: 'edita archivo',
        esquema: {},
        ejecutar: async () => 'archivo_modificado',
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [{ id: '1', nombre: 'read', argumentos: {} }],
          },
          {
            llamadasHerramienta: [{ id: '2', nombre: 'edit', argumentos: {} }],
          },
          {
            fragmentosTexto: ['La prueba pasa y la tarea terminó'],
          },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'agrega una prueba' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema itera hasta que el modelo informa que la tarea terminó y la prueba pasa
      expect(estado).toMatchObject({
        tipo: 'completado',
        pasosEjecutados: 3,
      })
    })

    it('El modelo termina sin pedir herramientas', async () => {
      // WHEN el modelo produce una respuesta final sin solicitar herramientas
      const registro = new RegistroHerramientas()
      const proveedor = new ProveedorSimulado({
        respuestas: [
          { fragmentosTexto: ['Respuesta directa sin herramientas'] },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'hola' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema cierra el turno y no vuelve a invocarlo
      expect(estado).toMatchObject({
        tipo: 'completado',
        pasosEjecutados: 1,
      })
    })

    it('Varias herramientas en un mismo turno', async () => {
      // WHEN el modelo solicita tres herramientas antes de responder
      const ejecutadas: string[] = []
      const registro = new RegistroHerramientas()
      for (const nombre of ['t1', 't2', 't3']) {
        registro.registrar({
          nombre,
          descripcion: `tool ${nombre}`,
          esquema: {},
          ejecutar: async () => {
            ejecutadas.push(nombre)
            return `ok_${nombre}`
          },
        })
      }

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'c1', nombre: 't1', argumentos: {} },
              { id: 'c2', nombre: 't2', argumentos: {} },
              { id: 'c3', nombre: 't3', argumentos: {} },
            ],
          },
          {
            fragmentosTexto: ['Fin de tres herramientas'],
          },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'ejecuta 3' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema ejecuta las tres y devuelve los tres resultados en esa misma respuesta
      expect(ejecutadas).toEqual(['t1', 't2', 't3'])
      const resultados = estado.mensajes.filter((m) => m.rol === 'tool')
      expect(resultados).toHaveLength(3)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El historial es atómico y un resultado siempre sigue a su mensaje
  // --------------------------------------------------------------------------
  describe('Requirement: El historial es atómico y un resultado siempre sigue a su mensaje', () => {
    it('Un resultado sin su mensaje es rechazado', async () => {
      // WHEN se intenta enviar un historial con un resultado de herramienta sin el mensaje del modelo que la solicitó
      const historialHuerfano: Mensaje[] = [
        { rol: 'user', contenido: 'hola' },
        { rol: 'tool', idLlamada: 'id_inexistente', resultado: 'resultado' },
      ]

      // THEN el sistema rechaza la petición antes de enviarla al provider
      const generador = ejecutarTurno({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        mensajes: historialHuerfano,
      })

      await expect(async () => {
        await consumirTurnoCompleto(generador)
      }).rejects.toThrow(ErrorHistorialInvalido)
    })

    it('Los mensajes del usuario no se alteran', async () => {
      // WHEN el usuario escribe un mensaje durante el turno
      const mensajeUsuario: Mensaje = {
        rol: 'user',
        contenido: 'Mensaje inmutable',
      }
      const mensajes = [mensajeUsuario]

      const generador = ejecutarTurno({
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['Respuesta'] }],
        }),
        registro: new RegistroHerramientas(),
        mensajes,
      })

      await consumirTurnoCompleto(generador)

      // THEN el sistema lo conserva sin modificar en el historial
      expect(mensajeUsuario.contenido).toBe('Mensaje inmutable')
      expect(mensajes[0]).toBe(mensajeUsuario)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Las herramientas se despachan contra un registro de datos
  // --------------------------------------------------------------------------
  describe('Requirement: Las herramientas se despachan contra un registro de datos', () => {
    it('Una herramienta nueva se agrega sin tocar el bucle', async () => {
      // WHEN se da de alta una herramienta nueva en el registro
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'herramienta_custom',
        descripcion: 'custom tool',
        esquema: {},
        ejecutar: async () => 'salida_custom',
      })

      // THEN el modelo puede solicitarla sin que el bucle cambie
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'c1', nombre: 'herramienta_custom', argumentos: {} },
            ],
          },
          { fragmentosTexto: ['Listo'] },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'usar custom' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      const toolResult = estado.mensajes.find(
        (m) => m.rol === 'tool' && m.resultado === 'salida_custom',
      )
      expect(toolResult).toBeDefined()
    })

    it('El nombre se resuelve contra el registro', async () => {
      // WHEN el modelo solicita una herramienta cuyo nombre está en el registro
      const registro = new RegistroHerramientas()
      let ejecutada = false
      registro.registrar({
        nombre: 'accion_concreta',
        descripcion: 'desc',
        esquema: {},
        ejecutar: async () => {
          ejecutada = true
          return 'hecho'
        },
      })

      // THEN el sistema ejecuta la función asociada a ese nombre
      const res = await despacharHerramienta('accion_concreta', {}, registro)
      expect(ejecutada).toBe(true)
      expect(res.resultado).toBe('hecho')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Los argumentos se validan contra el esquema antes de ejecutar
  // --------------------------------------------------------------------------
  describe('Requirement: Los argumentos se validan contra el esquema antes de ejecutar', () => {
    it('Faltan argumentos obligatorios', async () => {
      // WHEN el modelo solicita una herramienta sin uno de sus argumentos obligatorios
      const registro = new RegistroHerramientas()
      let intentoEjecutar = false
      registro.registrar({
        nombre: 'guardar',
        descripcion: 'desc',
        esquema: { required: ['archivo', 'contenido'] },
        ejecutar: async () => {
          intentoEjecutar = true
          return 'guardado'
        },
      })

      const res = await despacharHerramienta(
        'guardar',
        { archivo: 'a.txt' },
        registro,
      )

      // THEN el sistema no la ejecuta y devuelve al modelo un mensaje que indique qué argumento falta
      expect(intentoEjecutar).toBe(false)
      expect(res.esError).toBe(true)
      expect(res.resultado).toContain(
        "falta el argumento obligatorio 'contenido'",
      )
    })

    it('Los argumentos llegan como texto', async () => {
      // WHEN el modelo entrega los argumentos como una cadena de texto en lugar de una estructura
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'leer',
        descripcion: 'desc',
        esquema: { required: ['ruta'] },
        ejecutar: async (args) => `leido:${String(args.ruta)}`,
      })

      const res = await despacharHerramienta(
        'leer',
        '{"ruta": "docs/readme.md"}',
        registro,
      )

      // THEN el sistema interpreta la cadena antes de validarla contra el esquema
      expect(res.esError).toBe(false)
      expect(res.resultado).toBe('leido:docs/readme.md')
    })

    it('El modelo inventa un campo', async () => {
      // WHEN el modelo envía un campo que el esquema no declara
      const registro = new RegistroHerramientas()
      let argsRecibidos: Record<string, unknown> = {}
      registro.registrar({
        nombre: 'procesar',
        descripcion: 'desc',
        esquema: { properties: { id: { type: 'number' } }, required: ['id'] },
        ejecutar: async (args) => {
          argsRecibidos = args
          return 'ok'
        },
      })

      const res = await despacharHerramienta(
        'procesar',
        { id: 10, campo_inventado: 'extra' },
        registro,
      )

      // THEN el sistema lo descarta y valida el resto sin fallar
      expect(res.esError).toBe(false)
      expect(argsRecibidos).toHaveProperty('id', 10)
      expect(argsRecibidos).not.toHaveProperty('campo_inventado')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un error de ejecución vuelve al modelo como texto
  // --------------------------------------------------------------------------
  describe('Requirement: Un error de ejecución vuelve al modelo como texto', () => {
    it('Una prueba falla y el modelo se corrige', async () => {
      // WHEN el modelo ejecuta la suite de pruebas y una falla por un import mal escrito
      let turnoTest = 1
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'run_tests',
        descripcion: 'corre vitest',
        esquema: {},
        ejecutar: async () => {
          if (turnoTest === 1) {
            turnoTest++
            throw new Error('Error: Cannot find module ./utils.js')
          }
          return 'PASS all tests'
        },
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: '1', nombre: 'run_tests', argumentos: {} },
            ],
          },
          {
            fragmentosTexto: ['Veo el error de import y lo corrijo'],
            llamadasHerramienta: [
              { id: '2', nombre: 'run_tests', argumentos: {} },
            ],
          },
          {
            fragmentosTexto: ['Tests pasando con éxito'],
          },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'corre tests' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema devuelve el error como texto y el modelo lo lee y corrige en el siguiente paso sin intervención humana
      expect(estado.tipo).toBe('completado')
      const primerResultado = estado.mensajes.find(
        (m) => m.rol === 'tool' && m.idLlamada === '1',
      )
      expect(primerResultado?.resultado).toContain(
        'ERROR: Error: Cannot find module ./utils.js',
      )
      const segundoResultado = estado.mensajes.find(
        (m) => m.rol === 'tool' && m.idLlamada === '2',
      )
      expect(segundoResultado?.resultado).toBe('PASS all tests')
    })

    it('Una herramienta falla con una excepción inesperada', async () => {
      // WHEN una herramienta lanza una excepción no prevista
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'fallar',
        descripcion: 'desc',
        esquema: {},
        ejecutar: async () => {
          throw new Error('Excepcion inesperada de filesystem')
        },
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: '1', nombre: 'fallar', argumentos: {} },
            ],
          },
          { fragmentosTexto: ['Manejé el error'] },
        ],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'haz algo' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema la convierte en texto y el turno continúa
      expect(estado.tipo).toBe('completado')
      const toolRes = estado.mensajes.find((m) => m.rol === 'tool')
      expect(toolRes?.resultado).toContain('Excepcion inesperada de filesystem')
    })

    it('El mensaje de error no expone la credencial', async () => {
      // WHEN una herramienta falla con un error que contiene la credencial del provider
      const claveSecreta = 'sk-ant-clave-secreta-999'
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'falla_con_key',
        descripcion: 'desc',
        esquema: {},
        ejecutar: async () => {
          throw new Error(`Conexión rechazada con token=${claveSecreta}`)
        },
      })

      const res = await despacharHerramienta('falla_con_key', {}, registro, [
        claveSecreta,
      ])

      // THEN el sistema la omite del mensaje que vuelve al modelo
      expect(res.resultado).not.toContain(claveSecreta)
      expect(res.resultado).toContain('[REDACTADO]')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El límite de pasos interrumpe y devuelve el estado
  // --------------------------------------------------------------------------
  describe('Requirement: El límite de pasos interrumpe y devuelve el estado', () => {
    it('El modelo entra en un bucle y el turno se corta', async () => {
      // WHEN el modelo repite la misma herramienta y alcanza el límite de pasos
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'repetir',
        descripcion: 'loop',
        esquema: {},
        ejecutar: async () => 'mismo_resultado',
      })

      // Proveedor infinito solicitando la misma tool
      const proveedor = new ProveedorSimulado({
        respuestas: Array(10).fill({
          llamadasHerramienta: [
            { id: 'loop', nombre: 'repetir', argumentos: {} },
          ],
        }),
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'bucle infinito' }],
        limitePasos: 4,
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema interrumpe el turno y devuelve un mensaje que describa qué se hizo y qué quedó pendiente
      expect(estado.pasosEjecutados).toBe(4)
      const ultimoMensaje = estado.mensajes[estado.mensajes.length - 1]
      expect(ultimoMensaje?.contenido).toContain('límite de 4 pasos')
      expect(ultimoMensaje?.contenido).toContain('quedaron tareas pendientes')
    })

    it('Una tarea normal no se corta', async () => {
      // WHEN una tarea se completa en menos pasos que el límite
      const registro = new RegistroHerramientas()
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Tarea completada en paso 1'] }],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'tarea corta' }],
        limitePasos: 10,
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema la deja terminar sin interrumpirla
      expect(estado.tipo).toBe('completado')
      expect(estado.pasosEjecutados).toBe(1)
    })

    it('El valor por defecto es 25', () => {
      // WHEN el sistema arranca sin configuración explícita
      // THEN el límite de pasos del turno es 25
      expect(LIMITE_PASOS_POR_DEFECTO).toBe(25)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La cancelación interrumpe la petición en vuelo
  // --------------------------------------------------------------------------
  describe('Requirement: La cancelación interrumpe la petición en vuelo', () => {
    it('Se cancela esperando al modelo', async () => {
      // WHEN el usuario cancela mientras el sistema espera la respuesta del provider
      const controller = new AbortController()

      class ProveedorLento extends ProveedorSimulado {
        override async *enviar() {
          // Cancelar mientras el provider espera
          controller.abort()
          yield { tipo: 'texto' as const, delta: 'fragmento ignorado' }
        }
      }

      const generador = ejecutarTurno({
        proveedor: new ProveedorLento(),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'cancelar' }],
        senalCancelacion: controller.signal,
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema interrumpe la petición y no la continúa en segundo plano
      expect(estado.tipo).toBe('cancelado')
    })

    it('El turno queda marcado como cancelado', async () => {
      // WHEN un turno termina por cancelación
      const controller = new AbortController()
      controller.abort() // Cancelado previo

      const generador = ejecutarTurno({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'ya cancelado' }],
        senalCancelacion: controller.signal,
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema lo registra como cancelado y distingue ese estado de uno terminado
      expect(estado.tipo).toBe('cancelado')
      expect(estado.tipo).not.toBe('completado')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Todo turno termina en uno de tres estados consistentes
  // --------------------------------------------------------------------------
  describe('Requirement: Todo turno termina en uno de tres estados consistentes', () => {
    it('Turno completado', async () => {
      // WHEN el modelo termina sin solicitar más herramientas y no hubo errores
      const generador = ejecutarTurno({
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['Exito'] }],
        }),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'ok' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema registra el turno como completado
      expect(estado.tipo).toBe('completado')
    })

    it('Turno fallido', async () => {
      // WHEN el provider lanza un error que impide continuar
      class ProveedorConErrorFatal extends ProveedorSimulado {
        override async *enviar(): AsyncGenerator<
          EventoProveedor,
          void,
          unknown
        > {
          yield* []
          throw new Error('Fallo crítico e irrecuperable')
        }
      }

      const generador = ejecutarTurno({
        proveedor: new ProveedorConErrorFatal(),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'fallo' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el sistema registra el turno como fallido junto con el motivo
      expect(estado.tipo).toBe('fallido')
      if (estado.tipo === 'fallido') {
        expect(estado.motivo).toBe('Fallo crítico e irrecuperable')
      }
    })

    it('Se puede iniciar un turno nuevo después de cancelar', async () => {
      // WHEN un turno terminó cancelado y el usuario escribe un mensaje nuevo
      const controller = new AbortController()
      controller.abort()

      const generadorCancelado = ejecutarTurno({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'turno 1' }],
        senalCancelacion: controller.signal,
      })
      const res1 = await consumirTurnoCompleto(generadorCancelado)
      expect(res1.tipo).toBe('cancelado')

      // Turno nuevo
      const generadorNuevo = ejecutarTurno({
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['Turno 2 exitoso'] }],
        }),
        registro: new RegistroHerramientas(),
        mensajes: [{ rol: 'user', contenido: 'turno 2' }],
      })
      const res2 = await consumirTurnoCompleto(generadorNuevo)

      // THEN el sistema acepta el turno nuevo y el estado anterior no interfiere
      expect(res2.tipo).toBe('completado')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El núcleo no depende de la interfaz
  // --------------------------------------------------------------------------
  describe('Requirement: El núcleo no depende de la interfaz', () => {
    it('Un turno corre sin interfaz', async () => {
      // WHEN el núcleo se ejecuta con entrada y salida sin componentes visuales
      const registro = new RegistroHerramientas()
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Salida sin interfaz'] }],
      })

      const generador = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'test' }],
      })

      const estado = await consumirTurnoCompleto(generador)

      // THEN el turno se completa con el mismo resultado que con interfaz presente
      expect(estado.tipo).toBe('completado')
    })

    it('Cambiar de interfaz no toca el núcleo', () => {
      // WHEN se reemplaza la implementación de la interfaz
      // THEN el núcleo no cambia y los turnos se comportan igual
      // Verificación arquitectónica estricta (Regla 2 de AGENTS.md):
      const coreDir = join(process.cwd(), 'src', 'core')
      const archivos = readdirSync(coreDir).filter((f) => f.endsWith('.ts'))

      for (const archivo of archivos) {
        const contenido = readFileSync(join(coreDir, archivo), 'utf-8')
        expect(contenido).not.toMatch(/from\s+['"].*interface.*['"]/)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El presupuesto se verifica antes de cada petición
  // --------------------------------------------------------------------------
  describe('Requirement: El presupuesto se verifica antes de cada petición', () => {
    it('Un turno con varios pasos', async () => {
      // WHEN un turno ejecuta herramientas y el historial crece entre pasos
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {},
        ejecutar: async () => 'contenido',
      })
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [{ id: 'c1', nombre: 'read', argumentos: {} }],
          },
          { fragmentosTexto: ['fin'] },
        ],
      })
      let preparaciones = 0

      const estado = await consumirTurnoCompleto(
        ejecutarTurno({
          proveedor,
          registro,
          mensajes: [{ rol: 'user', contenido: 'leé' }],
          prepararHistorial: (mensajes) => {
            preparaciones++
            if (preparaciones === 2) {
              return { mensajes, error: 'presupuesto excedido' }
            }
            return { mensajes }
          },
        }),
      )

      // THEN el sistema verifica antes de cada petición y no envía la segunda
      expect(preparaciones).toBe(2)
      expect(proveedor.peticionesRecibidas).toHaveLength(1)
      expect(estado.tipo).toBe('fallido')
      if (estado.tipo === 'fallido') {
        expect(estado.motivo).toContain('presupuesto')
      }
    })

    it('El historial recortado se sincroniza', async () => {
      // WHEN la preparación reemplaza un resultado viejo
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {},
        ejecutar: async () => 'contenido original',
      })
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [{ id: 'c1', nombre: 'read', argumentos: {} }],
          },
          { fragmentosTexto: ['fin'] },
        ],
      })

      const estado = await consumirTurnoCompleto(
        ejecutarTurno({
          proveedor,
          registro,
          mensajes: [{ rol: 'user', contenido: 'leé' }],
          prepararHistorial: (mensajes) => ({
            mensajes: mensajes.map((mensaje) =>
              mensaje.rol === 'tool'
                ? { ...mensaje, resultado: 'resultado recortado' }
                : mensaje,
            ),
          }),
        }),
      )

      // THEN el estado final y la petición usan la misma versión recortada
      const resultado = estado.mensajes.find((m) => m.rol === 'tool')
      expect(resultado?.resultado).toBe('resultado recortado')
      const segundaPeticion = proveedor.peticionesRecibidas[1]
      expect(
        segundaPeticion?.mensajes.find((m) => m.rol === 'tool')?.resultado,
      ).toBe('resultado recortado')
    })
  })
})
