import type { ConteoTokens, Mensaje } from '../types.js'
import type { EtapaContexto, PresupuestoContexto } from './budget.js'
import { calcularTokensHistorial } from './tokens.js'

export interface ResumenCompactacion {
  antesTokens: number
  despuesTokens: number
  antesMensajes: number
  despuesMensajes: number
}

export interface OpcionesMedicionContexto {
  tokensSistema?: number | undefined
  tokensSkills?: number | undefined
  etapaAplicada?: EtapaContexto | undefined
  tokensRecuperados?: number | undefined
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
  tokensSistema?: number | undefined
  tokensSkills?: number | undefined
  etapaAplicada?: EtapaContexto | undefined
  tokensRecuperados?: number | undefined
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
  tokensSistemaOpciones: number | OpcionesMedicionContexto = 0,
): MetricasContexto {
  const opciones: OpcionesMedicionContexto =
    typeof tokensSistemaOpciones === 'number'
      ? { tokensSistema: tokensSistemaOpciones }
      : tokensSistemaOpciones
  const tokensSistema = opciones.tokensSistema ?? 0
  const tokensSkills = opciones.tokensSkills ?? 0
  const medicion = calcularTokensHistorial(mensajes, ultimoTokens)
  const tokensActuales = medicion.esEstimado
    ? medicion.tokens + tokensSistema + tokensSkills
    : medicion.tokens
  const disponible = Math.max(0, presupuesto.limitePresupuesto - tokensActuales)
  const porcentajeUso =
    presupuesto.limitePresupuesto > 0
      ? (tokensActuales / presupuesto.limitePresupuesto) * 100
      : 0

  return {
    ventanaContexto: presupuesto.ventanaContexto,
    limitePresupuesto: presupuesto.limitePresupuesto,
    margenReservado: presupuesto.margenConservado,
    tokensActuales,
    esEstimado: medicion.esEstimado,
    disponible,
    porcentajeUso,
    mensajes: mensajes.length,
    tokensAcumulados,
    ultimaCompactacion,
    ...(tokensSistema > 0 ? { tokensSistema } : {}),
    ...(tokensSkills > 0 ? { tokensSkills } : {}),
    ...(opciones.etapaAplicada
      ? { etapaAplicada: opciones.etapaAplicada }
      : {}),
    ...(opciones.tokensRecuperados !== undefined
      ? { tokensRecuperados: opciones.tokensRecuperados }
      : {}),
  }
}
