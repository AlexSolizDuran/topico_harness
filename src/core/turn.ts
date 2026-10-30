import type { Proveedor } from '../provider/types.js'
import type {
  ConteoTokens,
  EjecutorHooks,
  EstadoTurno,
  EventoTurno,
  Mensaje,
  PorteroPermisos,
  SolicitudHerramienta,
} from '../types.js'
import {
  type AlExplorarRutas,
  ejecutarTandasDeHerramientas,
} from './batches.js'
import { clonarHistorial, validarHistorialAtomico } from './history.js'
import { DetectorLoops } from './loops.js'
import type { RegistroHerramientas } from './registry.js'

export const LIMITE_PASOS_POR_DEFECTO = 25

export interface PreparacionHistorial {
  mensajes: Mensaje[]
  error?: string | undefined
  aviso?: string | undefined
}

export type PrepararHistorial = (mensajes: Mensaje[]) => PreparacionHistorial

export interface OpcionesTurno {
  proveedor: Proveedor
  registro: RegistroHerramientas
  mensajes: Mensaje[]
  sistema?: string | (() => string | undefined) | undefined
  limitePasos?: number | undefined
  senalCancelacion?: AbortSignal | undefined
  credencialesSanitizar?: string[] | undefined
  prepararHistorial?: PrepararHistorial | undefined
  portero?: PorteroPermisos | undefined
  enTurnoHijo?: boolean | undefined
  alExplorarRutas?: AlExplorarRutas | undefined
  hooks?: EjecutorHooks | undefined
}

interface ResultadoPasoProveedor {
  cancelado: boolean
  error?: Error | undefined
  textoTurno: string
  llamadasHerramientas: SolicitudHerramienta[]
  tokens?: ConteoTokens | undefined
}

function prepararHistorialAntesDeEnviar(
  opciones: OpcionesTurno,
  historial: Mensaje[],
): string | undefined {
  const preparado = opciones.prepararHistorial?.(historial)
  if (preparado && preparado.mensajes !== historial) {
    historial.splice(0, historial.length, ...preparado.mensajes)
    validarHistorialAtomico(historial)
  }
  return preparado?.error
}

function resolverSistema(
  sistema: OpcionesTurno['sistema'],
): string | undefined {
  if (typeof sistema === 'function') {
    return sistema()
  }
  return sistema
}

async function* consultarProveedor(
  opciones: OpcionesTurno,
  historial: Mensaje[],
): AsyncGenerator<EventoTurno, ResultadoPasoProveedor, unknown> {
  let textoTurno = ''
  const llamadasHerramientas: SolicitudHerramienta[] = []
  let tokens: ConteoTokens | undefined

  try {
    const errorPrep = prepararHistorialAntesDeEnviar(opciones, historial)
    if (errorPrep) {
      return {
        cancelado: false,
        error: new Error(errorPrep),
        textoTurno,
        llamadasHerramientas,
        tokens,
      }
    }

    const herramientas = opciones.registro.listarDefiniciones()
    const flujo = opciones.proveedor.enviar({
      mensajes: historial,
      herramientas: herramientas.length > 0 ? herramientas : undefined,
      sistema: resolverSistema(opciones.sistema),
      senalCancelacion: opciones.senalCancelacion,
    })

    for await (const evento of flujo) {
      if (opciones.senalCancelacion?.aborted) {
        return { cancelado: true, textoTurno, llamadasHerramientas, tokens }
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
      } else if (evento.tipo === 'fin') {
        tokens = evento.tokens
      }
    }

    return { cancelado: false, textoTurno, llamadasHerramientas, tokens }
  } catch (error) {
    if (opciones.senalCancelacion?.aborted) {
      return { cancelado: true, textoTurno, llamadasHerramientas, tokens }
    }
    return {
      cancelado: false,
      error: error instanceof Error ? error : new Error(String(error)),
      textoTurno,
      llamadasHerramientas,
      tokens,
    }
  }
}

async function* ejecutarUnPaso(
  paso: number,
  maxPasos: number,
  opciones: OpcionesTurno,
  historial: Mensaje[],
  detectorLoops: DetectorLoops,
): AsyncGenerator<EventoTurno, EstadoTurno | undefined, unknown> {
  yield { tipo: 'paso_inicio', paso }

  if (opciones.senalCancelacion?.aborted) {
    return { tipo: 'cancelado', mensajes: historial, pasosEjecutados: paso - 1 }
  }

  const resProveedor = yield* consultarProveedor(opciones, historial)

  if (resProveedor.cancelado) {
    return {
      tipo: 'cancelado',
      mensajes: historial,
      pasosEjecutados: paso,
      tokens: resProveedor.tokens,
    }
  }

  if (resProveedor.error) {
    return {
      tipo: 'fallido',
      motivo: resProveedor.error.message,
      mensajes: historial,
      pasosEjecutados: paso,
      tokens: resProveedor.tokens,
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
    return {
      tipo: 'completado',
      mensajes: historial,
      pasosEjecutados: paso,
      tokens: resProveedor.tokens,
    }
  }

  const resTandas = yield* ejecutarTandasDeHerramientas({
    llamadas: resProveedor.llamadasHerramientas,
    registro: opciones.registro,
    credenciales: opciones.credencialesSanitizar,
    senalCancelacion: opciones.senalCancelacion,
    portero: opciones.portero,
    detectorLoops,
    historial,
    alExplorarRutas: opciones.alExplorarRutas,
    hooks: opciones.hooks,
  })

  if (resTandas.cancelado) {
    return {
      tipo: 'cancelado',
      mensajes: historial,
      pasosEjecutados: paso,
      tokens: resProveedor.tokens,
    }
  }

  if (paso >= maxPasos) {
    yield { tipo: 'limite_pasos_alcanzado', pasos: paso }
    historial.push({
      rol: 'assistant',
      contenido: `Se alcanzó el límite de ${maxPasos} pasos. Estado actual: se ejecutaron ${paso} iteraciones y quedaron tareas pendientes.`,
    })

    return {
      tipo: 'completado',
      mensajes: historial,
      pasosEjecutados: paso,
      tokens: resProveedor.tokens,
    }
  }

  return undefined
}

async function* dispararHookFinTurno(
  opciones: OpcionesTurno,
): AsyncGenerator<EventoTurno, void, unknown> {
  if (!opciones.hooks || opciones.enTurnoHijo) return
  try {
    const res = await opciones.hooks.ejecutar({ evento: 'turnEnd' })
    for (const aviso of res.avisos) {
      yield { tipo: 'aviso_hook', texto: aviso }
    }
    for (const nota of res.notas) {
      yield { tipo: 'aviso_hook', texto: nota }
    }
    if (res.mensajeBloqueo) {
      yield { tipo: 'aviso_hook', texto: res.mensajeBloqueo }
    }
  } catch {
    // Nunca propaga un error de hook al cerrar el turno.
  }
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
  const detectorLoops = new DetectorLoops()

  validarHistorialAtomico(historial)

  if (opciones.senalCancelacion?.aborted) {
    yield* dispararHookFinTurno(opciones)
    return { tipo: 'cancelado', mensajes: historial, pasosEjecutados: 0 }
  }

  let paso = 0

  while (paso < maxPasos) {
    paso++
    const resultadoPaso = yield* ejecutarUnPaso(
      paso,
      maxPasos,
      opciones,
      historial,
      detectorLoops,
    )
    if (resultadoPaso) {
      yield* dispararHookFinTurno(opciones)
      return resultadoPaso
    }
  }

  yield* dispararHookFinTurno(opciones)
  return { tipo: 'completado', mensajes: historial, pasosEjecutados: paso }
}
