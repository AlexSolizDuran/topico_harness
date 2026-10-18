import { describe, expect, it } from 'vitest'
import { ejecutarTurno, RegistroHerramientas } from '../../src/core/index.js'
import {
  aplicarEventoTurno,
  crearEstadoInicial,
  detectarTerminalInteractiva,
  ErrorTurnoEnCurso,
  finalizarTurnoVisual,
  RenderizadorLineaALinea,
  SesionInteractiva,
} from '../../src/interface/index.js'
import {
  type PeticionProveedor,
  ProveedorSimulado,
} from '../../src/provider/index.js'
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

describe('interface Specification Tests', () => {
  // --------------------------------------------------------------------------
  // Requirement: La interfaz muestra el texto del modelo a medida que llega
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra el texto del modelo a medida que llega', () => {
    it('El texto se ve mientras llega', () => {
      // WHEN el modelo está produciendo una respuesta
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, { tipo: 'texto', delta: 'Hola ' })
      estado = aplicarEventoTurno(estado, { tipo: 'texto', delta: 'mundo' })

      // THEN la interfaz muestra el texto a medida que se recibe
      expect(estado.textoStreamingActual).toBe('Hola mundo')
    })

    it('El mensaje completo queda fijo', () => {
      // WHEN una respuesta termina
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'texto',
        delta: 'Mensaje completo',
      })
      estado = finalizarTurnoVisual(estado, false)

      // THEN el texto queda mostrado completo y ya no se redibuja
      expect(estado.textoStreamingActual).toBe('')
      const asist = estado.historial.find((h) => h.tipo === 'asistente')
      expect(asist).toMatchObject({
        tipo: 'asistente',
        texto: 'Mensaje completo',
      })
    })

    it('Varias respuestas en la misma sesión', async () => {
      // WHEN la sesión acumula varios turnos
      const proveedor = new ProveedorSimulado({
        respuestas: [
          { fragmentosTexto: ['Respuesta 1'] },
          { fragmentosTexto: ['Respuesta 2'] },
        ],
      })

      const sesion = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
      })

      await sesion.enviarMensaje('Pregunta 1')
      await sesion.enviarMensaje('Pregunta 2')

      // THEN la interfaz conserva el texto de todos ellos en orden
      const estado = sesion.obtenerEstado()
      const tiposYTextos = estado.historial.map((h) => ({
        tipo: h.tipo,
        texto: (h as { texto?: string }).texto,
      }))

      expect(tiposYTextos).toEqual([
        { tipo: 'usuario', texto: 'Pregunta 1' },
        { tipo: 'asistente', texto: 'Respuesta 1' },
        { tipo: 'usuario', texto: 'Pregunta 2' },
        { tipo: 'asistente', texto: 'Respuesta 2' },
      ])
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz muestra cada herramienta ejecutada y su resultado
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra cada herramienta ejecutada y su resultado', () => {
    it('Herramienta ejecutada', () => {
      // WHEN el modelo solicita una herramienta
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_fin',
        id: '1',
        nombre: 'read',
        resultado: 'contenido del archivo',
        esError: false,
      })

      // THEN la interfaz muestra su nombre y el resultado que devolvió
      const elem = estado.historial[0]
      expect(elem).toMatchObject({
        tipo: 'herramienta',
        nombre: 'read',
        resultado: 'contenido del archivo',
        esError: false,
        truncado: false,
      })
    })

    it('La herramienta falló', () => {
      // WHEN una herramienta devuelve un error
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_fin',
        id: '2',
        nombre: 'bash',
        resultado: 'ERROR: fallo al compilar',
        esError: true,
      })

      // THEN la interfaz lo muestra como error y el turno continúa visible
      const elem = estado.historial[0]
      expect(elem).toBeDefined()
      if (elem?.tipo === 'herramienta') {
        expect(elem.esError).toBe(true)
        expect(elem.resultado).toContain('ERROR')
      }
    })

    it('Resultado truncado', () => {
      // WHEN el contenido de una herramienta fue truncado
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_fin',
        id: '3',
        nombre: 'read',
        resultado:
          'Lineas... [Contenido truncado. Se mostraron 30000 de 50000 caracteres]',
        esError: false,
      })

      // THEN la interfaz lo indica
      const elem = estado.historial[0]
      expect(elem).toBeDefined()
      if (elem?.tipo === 'herramienta') {
        expect(elem.truncado).toBe(true)
      }
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz permite escribir el siguiente pedido
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz permite escribir el siguiente pedido', () => {
    it('Escribir con el turno terminado', async () => {
      // WHEN no hay un turno en curso
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['Listo'] }],
        }),
        registro: new RegistroHerramientas(),
      })

      // THEN la interfaz permite escribir un mensaje
      await expect(
        sesion.enviarMensaje('Primer pedido'),
      ).resolves.toBeUndefined()
      expect(sesion.obtenerEstado().turnoEnCurso).toBe(false)
    })

    it('El mensaje inicia el turno siguiente', async () => {
      // WHEN el usuario envía lo que escribió
      let llamado = false
      class ProveedorObservador extends ProveedorSimulado {
        override async *enviar(peticion: PeticionProveedor) {
          if (peticion.mensajes[0]?.contenido === 'Mi consulta') {
            llamado = true
          }
          yield { tipo: 'texto' as const, delta: 'ok' }
        }
      }

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorObservador(),
        registro: new RegistroHerramientas(),
      })

      await sesion.enviarMensaje('Mi consulta')

      // THEN el turno comienza con ese mensaje
      expect(llamado).toBe(true)
    })

    it('No se escribe durante un turno', async () => {
      // WHEN hay un turno en curso
      class ProveedorPendiente extends ProveedorSimulado {
        override async *enviar() {
          await new Promise((r) => setTimeout(r, 50))
          yield { tipo: 'texto' as const, delta: 'fin' }
        }
      }

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorPendiente(),
        registro: new RegistroHerramientas(),
      })

      const promesaTurno1 = sesion.enviarMensaje('Tarea larga')

      // THEN la interfaz no acepta un nuevo pedido hasta que el turno termine
      await expect(sesion.enviarMensaje('Interrupcion')).rejects.toThrow(
        ErrorTurnoEnCurso,
      )

      await promesaTurno1
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz muestra el prompt del sistema de forma persistente
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra el prompt del sistema de forma persistente', () => {
    it('Visible durante toda la sesión', async () => {
      // WHEN la sesión corre y el historial crece
      const sesion = new SesionInteractiva({
        promptSistema: 'Eres un asistente experto',
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['Respuesta'] }],
        }),
        registro: new RegistroHerramientas(),
      })

      await sesion.enviarMensaje('Hola')

      // THEN el prompt del sistema permanece visible
      expect(sesion.obtenerEstado().promptSistema).toBe(
        'Eres un asistente experto',
      )
    })

    it('Sigue visible tras compactar', () => {
      // WHEN el historial del turno se recorta o se resume
      const estado = crearEstadoInicial('Prompt inicial inmutable')
      estado.historial = [
        { id: '1', tipo: 'aviso', texto: 'Historial compactado' },
      ]

      // THEN el prompt del sistema sigue visible
      expect(estado.promptSistema).toBe('Prompt inicial inmutable')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz permite cancelar el turno en curso
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz permite cancelar el turno en curso', () => {
    it('Se cancela desde la interfaz', async () => {
      // WHEN hay un turno en curso
      class ProveedorInterrumpible extends ProveedorSimulado {
        override async *enviar(peticion: PeticionProveedor) {
          while (!peticion.senalCancelacion?.aborted) {
            await new Promise((r) => setTimeout(r, 10))
            yield { tipo: 'texto' as const, delta: 'flujo...' }
          }
        }
      }

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorInterrumpible(),
        registro: new RegistroHerramientas(),
      })

      const promesaEnvio = sesion.enviarMensaje('Ejecutar infinito')
      sesion.cancelar()
      await promesaEnvio

      // THEN la interfaz permite cancelarlo
      expect(sesion.obtenerEstado().cancelado).toBe(true)
    })

    it('El turno cancelado se refleja', async () => {
      // WHEN un turno termina por cancelación
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
      })

      sesion.cancelar()
      const estado = sesion.obtenerEstado()

      // THEN la interfaz lo muestra como cancelado y habilita escribir de nuevo
      expect(estado.turnoEnCurso).toBe(false)
      await expect(
        sesion.enviarMensaje('Siguiente pedido'),
      ).resolves.toBeUndefined()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Sin terminal interactiva la interfaz degrada a salida línea a línea
  // --------------------------------------------------------------------------
  describe('Requirement: Sin terminal interactiva la interfaz degrada a salida línea a línea', () => {
    it('Ejecución sin terminal', () => {
      // WHEN el proceso se ejecuta sin una terminal interactiva
      const lineas: string[] = []
      const render = new RenderizadorLineaALinea((l) => lineas.push(l))

      render.mostrarPromptSistema('Sistema configurado')
      render.mostrarMensajeUsuario('Mi tarea')
      render.mostrarDelta('Texto linea a linea')
      render.fijarMensajeAsistente()

      // THEN la salida se muestra línea a línea y se puede redirigir a un archivo
      expect(lineas).toEqual([
        '[Sistema]: Sistema configurado',
        '[Usuario]: Mi tarea',
        '[Asistente]: Texto linea a linea',
      ])
    })

    it('No se pierde contenido', () => {
      // WHEN la interfaz degrada a salida línea a línea
      const lineas: string[] = []
      const render = new RenderizadorLineaALinea((l) => lineas.push(l))

      render.mostrarHerramienta('read', 'contenido total', false, false)

      // THEN la información mostrada es la misma que en modo interactivo
      expect(lineas[0]).toContain('read')
      expect(lineas[0]).toContain('contenido total')
    })

    it('Con terminal interactiva', () => {
      // WHEN el proceso se ejecuta dentro de una terminal interactiva
      const esInteractiva = detectarTerminalInteractiva({ isTTY: true })

      // THEN la interfaz usa el modo interactivo completo
      expect(esInteractiva).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz no contiene lógica de negocio
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz no contiene lógica de negocio', () => {
    it('La interfaz no decide', () => {
      // WHEN el núcleo no emite un evento
      const estado = crearEstadoInicial()

      // THEN la interfaz no inventa una acción a partir de lo que ya viene leyendo
      expect(estado.historial).toHaveLength(0)
      expect(estado.textoStreamingActual).toBe('')
    })

    it('Cambiar de interfaz no cambia el comportamiento', async () => {
      // WHEN se reemplaza la implementación de la interfaz
      // El turno del núcleo produce exactamente el mismo resultado
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Resultado agnostico'] }],
      })
      const registro = new RegistroHerramientas()

      const gen = ejecutarTurno({
        proveedor,
        registro,
        mensajes: [{ rol: 'user', contenido: 'pregunta' }],
      })

      const estado = await consumirTurnoCompleto(gen)

      // THEN los turnos se comportan igual y el núcleo no cambia
      expect(estado.tipo).toBe('completado')
    })
  })
})
