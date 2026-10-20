import type { ConteoTokens, Mensaje } from '../types.js'
import type { PresupuestoContexto } from './budget.js'
import { calcularTokensHistorial } from './tokens.js'

export interface ResumenCompactacion {
  antesTokens: number
  despuesTokens: number
  antesMensajes: number
  despuesMensajes: number
}

export interface MetricasContexto {
  ventanaContexto: number
  limitePresupuesto: number
  margenReservado: number
  tokensActuales: number
  esEstimado: boolean
  disponible: number
  porcentajeUso: number
  mensajes: number
  tokensAcumulados: number
  ultimaCompactacion?: ResumenCompactacion | undefined
}

export function crearMetricasVacias(): MetricasContexto {
  return {
    ventanaContexto: 0,
    limitePresupuesto: 0,
    margenReservado: 0,
    tokensActuales: 0,
    esEstimado: true,
    disponible: 0,
    porcentajeUso: 0,
    mensajes: 0,
    tokensAcumulados: 0,
  }
}

export function medirContexto(
  presupuesto: PresupuestoContexto,
  mensajes: Mensaje[],
  ultimoTokens?: ConteoTokens | undefined,
  tokensAcumulados = 0,
  ultimaCompactacion?: ResumenCompactacion | undefined,
): MetricasContexto {
  const medicion = calcularTokensHistorial(mensajes, ultimoTokens)
  const disponible = Math.max(
    0,
    presupuesto.limitePresupuesto - medicion.tokens,
  )
  const porcentajeUso =
    presupuesto.limitePresupuesto > 0
      ? (medicion.tokens / presupuesto.limitePresupuesto) * 100
      : 0

  return {
    ventanaContexto: presupuesto.ventanaContexto,
    limitePresupuesto: presupuesto.limitePresupuesto,
    margenReservado: presupuesto.margenConservado,
    tokensActuales: medicion.tokens,
    esEstimado: medicion.esEstimado,
    disponible,
    porcentajeUso,
    mensajes: mensajes.length,
    tokensAcumulados,
    ultimaCompactacion,
  }
}
