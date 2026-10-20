import type { Proveedor } from '../provider/types.js'
import type {
  EstadoTurno,
  EventoTurno,
  Mensaje,
  SolicitudHerramienta,
} from '../types.js'
import { despacharHerramienta } from './dispatch.js'
import { clonarHistorial, validarHistorialAtomico } from './history.js'
import type { RegistroHerramientas } from './registry.js'

export const LIMITE_PASOS_POR_DEFECTO = 25

export interface OpcionesTurno {
  proveedor: Proveedor
  registro: RegistroHerramientas
  mensajes: Mensaje[]
  sistema?: string | undefined
  limitePasos?: number | undefined
  senalCancelacion?: AbortSignal | undefined
  credencialesSanitizar?: string[] | undefined
}

interface ResultadoPasoProveedor {
  cancelado: boolean
  error?: Error | undefined
  textoTurno: string
  llamadasHerramientas: SolicitudHerramienta[]
}

async function* consultarProveedor(
  opciones: OpcionesTurno,
  historial: Mensaje[],
): AsyncGenerator<EventoTurno, ResultadoPasoProveedor, unknown> {
  let textoTurno = ''
  const llamadasHerramientas: SolicitudHerramienta[] = []

  try {
    const herramientas = opciones.registro.listarDefiniciones()
    const flujo = opciones.proveedor.enviar({
      mensajes: historial,
      herramientas: herramientas.length > 0 ? herramientas : undefined,
      sistema: opciones.sistema,
      senalCancelacion: opciones.senalCancelacion,
    })

    for await (const evento of flujo) {
      if (opciones.senalCancelacion?.aborted) {
        return { cancelado: true, textoTurno, llamadasHerramientas }
      }

      if (evento.tipo === 'texto') {
        textoTurno += evento.delta
        yield { tipo: 'texto', delta: evento.delta }
      } else if (evento.tipo === 'solicitud_herramienta') {
        llamadasHerramientas.push({
          id: evento.id,
          nombre: evento.nombre,
          argumentos: evento.argumentos,
        })
      }
    }

    return { cancelado: false, textoTurno, llamadasHerramientas }
  } catch (error) {
    if (opciones.senalCancelacion?.aborted) {
      return { cancelado: true, textoTurno, llamadasHerramientas }
    }
    return {
      cancelado: false,
      error: error instanceof Error ? error : new Error(String(error)),
      textoTurno,
      llamadasHerramientas,
    }
  }
}

async function* ejecutarLlamadasHerramientas(
  llamadas: SolicitudHerramienta[],
  registro: RegistroHerramientas,
  credenciales: string[] | undefined,
  historial: Mensaje[],
): AsyncGenerator<EventoTurno, void, unknown> {
  for (const llamada of llamadas) {
    yield {
      tipo: 'herramienta_inicio',
      id: llamada.id,
      nombre: llamada.nombre,
      argumentos: llamada.argumentos,
    }

    const despacho = await despacharHerramienta(
      llamada.nombre,
      llamada.argumentos,
      registro,
      credenciales,
    )

    yield {
      tipo: 'herramienta_fin',
      id: llamada.id,
      nombre: llamada.nombre,
      resultado: despacho.resultado,
      esError: despacho.esError,
    }

    historial.push({
      rol: 'tool',
      idLlamada: llamada.id,
      resultado: despacho.resultado,
    })
  }
}

async function* ejecutarUnPaso(
  paso: number,
  maxPasos: number,
  opciones: OpcionesTurno,
  historial: Mensaje[],
): AsyncGenerator<EventoTurno, EstadoTurno | undefined, unknown> {
  yield { tipo: 'paso_inicio', paso }

  if (opciones.senalCancelacion?.aborted) {
    return { tipo: 'cancelado', mensajes: historial, pasosEjecutados: paso - 1 }
  }

  const genProveedor = consultarProveedor(opciones, historial)
  let pasoRes = await genProveedor.next()

  while (!pasoRes.done) {
    yield pasoRes.value
    pasoRes = await genProveedor.next()
  }

  const resProveedor = pasoRes.value

  if (resProveedor.cancelado) {
    return { tipo: 'cancelado', mensajes: historial, pasosEjecutados: paso }
  }

  if (resProveedor.error) {
    return {
      tipo: 'fallido',
      motivo: resProveedor.error.message,
      mensajes: historial,
      pasosEjecutados: paso,
    }
  }

  historial.push({
    rol: 'assistant',
    contenido:
      resProveedor.textoTurno.length > 0 ? resProveedor.textoTurno : undefined,
    llamadasHerramientas:
      resProveedor.llamadasHerramientas.length > 0
        ? resProveedor.llamadasHerramientas
        : undefined,
  })

  if (resProveedor.llamadasHerramientas.length === 0) {
    return { tipo: 'completado', mensajes: historial, pasosEjecutados: paso }
  }

  yield* ejecutarLlamadasHerramientas(
    resProveedor.llamadasHerramientas,
    opciones.registro,
    opciones.credencialesSanitizar,
    historial,
  )

  if (paso >= maxPasos) {
    yield { tipo: 'limite_pasos_alcanzado', pasos: paso }
    historial.push({
      rol: 'assistant',
      contenido: `Se alcanzó el límite de ${maxPasos} pasos. Estado actual: se ejecutaron ${paso} iteraciones y quedaron tareas pendientes.`,
    })

    return { tipo: 'completado', mensajes: historial, pasosEjecutados: paso }
  }

  return undefined
}

/**
 * Ejecuta un turno completo del agente como un generador asíncrono de eventos,
 * retornando un EstadoTurno consistente (completado, cancelado o fallido).
 */
export async function* ejecutarTurno(
  opciones: OpcionesTurno,
): AsyncGenerator<EventoTurno, EstadoTurno, unknown> {
  const maxPasos = opciones.limitePasos ?? LIMITE_PASOS_POR_DEFECTO
  const historial: Mensaje[] = clonarHistorial(opciones.mensajes)

  validarHistorialAtomico(historial)

  if (opciones.senalCancelacion?.aborted) {
    return { tipo: 'cancelado', mensajes: historial, pasosEjecutados: 0 }
  }

  let paso = 0

  while (paso < maxPasos) {
    paso++
    const genPaso = ejecutarUnPaso(paso, maxPasos, opciones, historial)
    let iter = await genPaso.next()

    while (!iter.done) {
      yield iter.value
      iter = await genPaso.next()
    }

    if (iter.value) {
      return iter.value
    }
  }

  return { tipo: 'completado', mensajes: historial, pasosEjecutados: paso }
}
