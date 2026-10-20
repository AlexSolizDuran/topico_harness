import {
  crearMetricasVacias,
  type MetricasContexto,
} from '../context/metrics.js'
import type { EventoTurno } from '../types.js'

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
  | { id: string; tipo: 'aviso'; texto: string }

export interface EstadoSesionVisual {
  promptSistema: string
  historial: ElementoVisual[]
  textoStreamingActual: string
  turnoEnCurso: boolean
  cancelado: boolean
  modeloActivo: string
  contexto: MetricasContexto
  herramientaEnCurso?: HerramientaEnCurso | undefined
}

export function crearEstadoInicial(
  promptSistema = '',
  modeloActivo = '',
  contexto: MetricasContexto = crearMetricasVacias(),
): EstadoSesionVisual {
  return {
    promptSistema,
    historial: [],
    textoStreamingActual: '',
    turnoEnCurso: false,
    cancelado: false,
    modeloActivo,
    contexto,
  }
}

/**
 * Aplica un evento emitido por el núcleo para actualizar el estado visual de la interfaz.
 * La interfaz no toma decisiones: solo refleja los eventos.
 */
export function aplicarEventoTurno(
  estado: EstadoSesionVisual,
  evento: EventoTurno,
): EstadoSesionVisual {
  const nuevo = { ...estado, historial: [...estado.historial] }

  if (evento.tipo === 'texto') {
    nuevo.textoStreamingActual += evento.delta
    return nuevo
  }

  if (evento.tipo === 'herramienta_inicio') {
    if (nuevo.textoStreamingActual.length > 0) {
      nuevo.historial.push({
        id: generarIdVisual(),
        tipo: 'asistente',
        texto: nuevo.textoStreamingActual,
      })
      nuevo.textoStreamingActual = ''
    }
    nuevo.herramientaEnCurso = {
      id: evento.id,
      nombre: evento.nombre,
      argumentos: evento.argumentos,
      iniciadaEn: Date.now(),
    }
    return nuevo
  }

  if (evento.tipo === 'herramienta_fin') {
    const esTruncado = evento.resultado.includes('[Contenido truncado')
    const enCurso = nuevo.herramientaEnCurso
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'herramienta',
      nombre: evento.nombre,
      argumentos: enCurso?.id === evento.id ? enCurso.argumentos : undefined,
      resultado: evento.resultado,
      esError: evento.esError,
      truncado: esTruncado,
    })
    nuevo.herramientaEnCurso = undefined
    return nuevo
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
  const nuevo = { ...estado, historial: [...estado.historial] }

  if (nuevo.textoStreamingActual.length > 0) {
    nuevo.historial.push({
      id: generarIdVisual(),
      tipo: 'asistente',
      texto: nuevo.textoStreamingActual,
    })
    nuevo.textoStreamingActual = ''
  }

  nuevo.turnoEnCurso = false
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
