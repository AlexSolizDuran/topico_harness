import {
  crearMetricasVacias,
  type MetricasContexto,
} from '../context/metrics.js'
import type { EventoTurno, SolicitudAprobacion } from '../types.js'

let contadorVisual = 0
export function generarIdVisual(): string {
  contadorVisual++
  return `v-${contadorVisual}`
}

export interface HerramientaEnCurso {
  id: string
  nombre: string
  argumentos: Record<string, unknown>
  iniciadaEn: number
  completada?: boolean | undefined
  resultado?: string | undefined
  esError?: boolean | undefined
  truncado?: boolean | undefined
}

export type ElementoVisual =
  | { id: string; tipo: 'usuario'; texto: string }
  | { id: string; tipo: 'asistente'; texto: string }
  | {
      id: string
      tipo: 'herramienta'
      nombre: string
      argumentos?: Record<string, unknown> | undefined
      resultado: string
      esError: boolean
      truncado: boolean
    }
  | {
      id: string
      tipo: 'delegacion'
      subagente: string
      pedido: string
      resultado: string
      esError: boolean
      truncado: boolean
    }
  | { id: string; tipo: 'aviso'; texto: string }

export interface EstadoSesionVisual {
  promptSistema: string
  historial: ElementoVisual[]
  textoStreamingActual: string
  turnoEnCurso: boolean
  esperandoAprobacion: boolean
  aprobacionPendiente?: SolicitudAprobacion | undefined
  cancelado: boolean
  modeloActivo: string
  agenteActivo: string
  contexto: MetricasContexto
  herramientaEnCurso?: HerramientaEnCurso | undefined
  herramientasEnCurso: HerramientaEnCurso[]
}

export function crearEstadoInicial(
  promptSistema = '',
  modeloActivo = '',
  contexto: MetricasContexto = crearMetricasVacias(),
  agenteActivo = 'build',
): EstadoSesionVisual {
  return {
    promptSistema,
    historial: [],
    textoStreamingActual: '',
    turnoEnCurso: false,
    esperandoAprobacion: false,
    cancelado: false,
    modeloActivo,
    agenteActivo,
    contexto,
    herramientasEnCurso: [],
  }
}

function convertirTarjetaAHistorial(item: HerramientaEnCurso): ElementoVisual {
  const resultado = item.resultado ?? ''
  const esError = Boolean(item.esError)
  const truncado = Boolean(item.truncado)

  if (item.nombre === 'task') {
    const subagente = String(item.argumentos.agent ?? 'subagente')
    const pedido = String(item.argumentos.prompt ?? '')
    return {
      id: generarIdVisual(),
      tipo: 'delegacion',
      subagente,
      pedido,
      resultado,
      esError,
      truncado,
    }
  }

  return {
    id: generarIdVisual(),
    tipo: 'herramienta',
    nombre: item.nombre,
    argumentos: item.argumentos,
    resultado,
    esError,
    truncado,
  }
}

function manejarInicioHerramienta(
  nuevo: EstadoSesionVisual,
  evento: Extract<EventoTurno, { tipo: 'herramienta_inicio' }>,
): EstadoSesionVisual {
  if (nuevo.textoStreamingActual.length > 0) {
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'asistente',
      texto: nuevo.textoStreamingActual,
    })
    nuevo.textoStreamingActual = ''
  }

  const entrada: HerramientaEnCurso = {
    id: evento.id,
    nombre: evento.nombre,
    argumentos: evento.argumentos,
    iniciadaEn: Date.now(),
    completada: false,
  }

  nuevo.herramientasEnCurso.push(entrada)
  nuevo.herramientaEnCurso = nuevo.herramientasEnCurso.find(
    (h) => !h.completada,
  )
  return nuevo
}

function manejarFinHerramienta(
  nuevo: EstadoSesionVisual,
  evento: Extract<EventoTurno, { tipo: 'herramienta_fin' }>,
): EstadoSesionVisual {
  const esTruncado = evento.resultado.includes('[Contenido truncado')
  const indice = nuevo.herramientasEnCurso.findIndex((h) => h.id === evento.id)

  if (indice === -1) {
    const temporal: HerramientaEnCurso = {
      id: evento.id,
      nombre: evento.nombre,
      argumentos:
        nuevo.herramientaEnCurso?.id === evento.id
          ? nuevo.herramientaEnCurso.argumentos
          : {},
      iniciadaEn: Date.now(),
      completada: true,
      resultado: evento.resultado,
      esError: evento.esError,
      truncado: esTruncado,
    }
    nuevo.historial.push(convertirTarjetaAHistorial(temporal))
    nuevo.herramientaEnCurso = undefined
    return nuevo
  }

  const actual = nuevo.herramientasEnCurso[indice]
  if (actual) {
    nuevo.herramientasEnCurso[indice] = {
      ...actual,
      completada: true,
      resultado: evento.resultado,
      esError: evento.esError,
      truncado: esTruncado,
    }
  }

  const todasCompletadas = nuevo.herramientasEnCurso.every((h) => h.completada)
  if (todasCompletadas) {
    for (const item of nuevo.herramientasEnCurso) {
      nuevo.historial.push(convertirTarjetaAHistorial(item))
    }
    nuevo.herramientasEnCurso = []
    nuevo.herramientaEnCurso = undefined
  } else {
    nuevo.herramientaEnCurso = nuevo.herramientasEnCurso.find(
      (h) => !h.completada,
    )
  }

  return nuevo
}

/**
 * Aplica un evento emitido por el núcleo para actualizar el estado visual de la interfaz.
 * La interfaz no toma decisiones: solo refleja los eventos.
 */
export function aplicarEventoTurno(
  estado: EstadoSesionVisual,
  evento: EventoTurno,
): EstadoSesionVisual {
  const nuevo: EstadoSesionVisual = {
    ...estado,
    historial: [...estado.historial],
    herramientasEnCurso: [...(estado.herramientasEnCurso ?? [])],
  }

  if (evento.tipo === 'texto') {
    nuevo.textoStreamingActual += evento.delta
    return nuevo
  }

  if (evento.tipo === 'espera_aprobacion') {
    nuevo.esperandoAprobacion = true
    nuevo.aprobacionPendiente = evento.solicitud
    return nuevo
  }

  if (evento.tipo === 'fin_espera_aprobacion') {
    nuevo.esperandoAprobacion = false
    nuevo.aprobacionPendiente = undefined
    return nuevo
  }

  if (evento.tipo === 'herramienta_inicio') {
    return manejarInicioHerramienta(nuevo, evento)
  }

  if (evento.tipo === 'herramienta_fin') {
    return manejarFinHerramienta(nuevo, evento)
  }

  if (evento.tipo === 'limite_pasos_alcanzado') {
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'aviso',
      texto: `Se alcanzó el límite de ${evento.pasos} pasos.`,
    })
    return nuevo
  }

  return nuevo
}

/**
 * Concluye un turno fijando el texto en streaming al historial definitivo.
 */
export function finalizarTurnoVisual(
  estado: EstadoSesionVisual,
  cancelado = false,
): EstadoSesionVisual {
  const nuevo: EstadoSesionVisual = {
    ...estado,
    historial: [...estado.historial],
    herramientasEnCurso: [],
  }

  if (nuevo.textoStreamingActual.length > 0) {
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'asistente',
      texto: nuevo.textoStreamingActual,
    })
    nuevo.textoStreamingActual = ''
  }

  nuevo.turnoEnCurso = false
  nuevo.esperandoAprobacion = false
  nuevo.aprobacionPendiente = undefined
  nuevo.cancelado = cancelado
  nuevo.herramientaEnCurso = undefined

  if (cancelado) {
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'aviso',
      texto: 'Turno cancelado.',
    })
  }

  return nuevo
}
