import type { ConteoTokens, Mensaje } from '../types.js'
import type { EtapaContexto, PresupuestoContexto } from './budget.js'
import {
  compactarHistorial,
  type GeneradorResumen,
  MINIMO_BYTES_BLOQUE_RESUMEN,
  resumirBloqueMasAntiguo,
} from './compaction.js'
import { podarPasosLectura } from './pruning.js'
import { calcularTokensHistorial } from './tokens.js'
import { recortarSalidasHerramientasViejas } from './trimming.js'

export interface OpcionesPipelineContexto {
  minimoBytesRecorte?: number | undefined
  minimoBytesBloqueResumen?: number | undefined
  generadorResumen?: GeneradorResumen | undefined
}

export interface ResultadoPipeline {
  mensajes: Mensaje[]
  ultimoTokens?: ConteoTokens | undefined
  recortado: boolean
  podado: boolean
  resumido: boolean
  compactado: boolean
  excedePresupuesto: boolean
  etapaAplicada: EtapaContexto
  tokensRecuperados: number
  porcentajeUso: number
  avisoUmbral?: number | undefined
  error?: string | undefined
}

const MAXIMO_COMPACTACIONES = 8

function ejecutarCompactacionCompleta(
  inicial: Mensaje[],
  presupuesto: PresupuestoContexto,
  generadorResumen?: GeneradorResumen | undefined,
): { mensajes: Mensaje[]; compactado: boolean } {
  let actuales = inicial
  let compactado = false
  let iteraciones = 0
  let recientesAConservar = 2

  while (
    (presupuesto.alcanzaUmbral(
      'compactar',
      calcularTokensHistorial(actuales).tokens,
    ) ||
      presupuesto.haAlcanzadoLimite(
        calcularTokensHistorial(actuales).tokens,
      )) &&
    iteraciones < MAXIMO_COMPACTACIONES
  ) {
    const siguientes = compactarHistorial(
      actuales,
      recientesAConservar,
      generadorResumen,
    )
    const huboProgreso =
      siguientes !== actuales && siguientes.length < actuales.length
    if (!huboProgreso) {
      if (recientesAConservar > 1) {
        recientesAConservar--
        continue
      }
      break
    }
    actuales = siguientes
    compactado = true
    iteraciones++
    if (recientesAConservar > 1) {
      recientesAConservar--
    }
  }

  return { mensajes: actuales, compactado }
}

/**
 * Se ejecuta al final del turno escalando por etapas (aviso 70% -> enmascarar 80%
 * -> podar 85% -> resumir 90% -> compactar 99%) y deteniéndose en la primera
 * etapa que baje del umbral correspondiente.
 */
export function aplicarPipelineContexto(
  mensajes: Mensaje[],
  presupuesto: PresupuestoContexto,
  ultimoTokens?: ConteoTokens | undefined,
  opciones: OpcionesPipelineContexto = {},
): ResultadoPipeline {
  const medicionInicial = calcularTokensHistorial(mensajes, ultimoTokens)
  const tokensIniciales = medicionInicial.tokens
  const tokensEstimadosAntes = calcularTokensHistorial(mensajes).tokens
  const porcentajeInicial = presupuesto.porcentajeSobreLimite(tokensIniciales)

  try {
    if (!presupuesto.alcanzaUmbral('aviso', tokensIniciales)) {
      return {
        mensajes,
        ultimoTokens,
        recortado: false,
        podado: false,
        resumido: false,
        compactado: false,
        excedePresupuesto: false,
        etapaAplicada: 'ninguna',
        tokensRecuperados: 0,
        porcentajeUso: porcentajeInicial,
      }
    }

    if (!presupuesto.alcanzaUmbral('enmascarar', tokensIniciales)) {
      return {
        mensajes,
        ultimoTokens,
        recortado: false,
        podado: false,
        resumido: false,
        compactado: false,
        excedePresupuesto: false,
        etapaAplicada: 'aviso',
        tokensRecuperados: 0,
        porcentajeUso: porcentajeInicial,
        avisoUmbral: Math.round(porcentajeInicial),
      }
    }

    let actuales = mensajes
    let huboCambio = false
    let recortado = false
    let podado = false
    let resumido = false
    let compactado = false
    let etapaAplicada: EtapaContexto = 'aviso'

    const medirActuales = (): number =>
      huboCambio ? calcularTokensHistorial(actuales).tokens : tokensIniciales

    // Etapa 1: Enmascarar (80%)
    const trasRecorte = recortarSalidasHerramientasViejas(
      actuales,
      opciones.minimoBytesRecorte,
    )
    if (trasRecorte.some((m, idx) => m !== actuales[idx])) {
      actuales = trasRecorte
      huboCambio = true
      recortado = true
      etapaAplicada = 'enmascarar'
    }

    // Etapa 2: Podar (85%) si el enmascarado no alcanzó para quedar bajo el umbral de poda
    if (presupuesto.alcanzaUmbral('podar', medirActuales())) {
      const trasPoda = podarPasosLectura(actuales)
      if (trasPoda !== actuales && trasPoda.length < actuales.length) {
        actuales = trasPoda
        huboCambio = true
        podado = true
        etapaAplicada = 'podar'
      }
    }

    // Etapa 3: Resumir el bloque más antiguo (90%) cuando aún no se alcanzó el umbral de compactación (99%)
    if (
      presupuesto.alcanzaUmbral('resumir', medirActuales()) &&
      !presupuesto.alcanzaUmbral('compactar', medirActuales())
    ) {
      const trasResumenBloque = resumirBloqueMasAntiguo(actuales, {
        minimoBytesBloque:
          opciones.minimoBytesBloqueResumen ?? MINIMO_BYTES_BLOQUE_RESUMEN,
        generadorResumen: opciones.generadorResumen,
      })
      if (
        trasResumenBloque !== actuales &&
        trasResumenBloque.length < actuales.length
      ) {
        actuales = trasResumenBloque
        huboCambio = true
        resumido = true
        compactado = true
        etapaAplicada = 'resumir'
      }
    }

    // Etapa 4: Compactar el historial completo (99%) si aún alcanza el umbral de compactación
    if (presupuesto.alcanzaUmbral('compactar', medirActuales())) {
      const resultadoComp = ejecutarCompactacionCompleta(
        actuales,
        presupuesto,
        opciones.generadorResumen,
      )
      if (resultadoComp.compactado) {
        actuales = resultadoComp.mensajes
        huboCambio = true
        compactado = true
        etapaAplicada = 'compactar'
      }
    }

    const tokensFinales = calcularTokensHistorial(actuales).tokens
    const tokensRecuperados = huboCambio
      ? Math.max(0, tokensEstimadosAntes - tokensFinales)
      : 0

    return {
      mensajes: actuales,
      ultimoTokens: huboCambio ? undefined : ultimoTokens,
      recortado,
      podado,
      resumido,
      compactado,
      excedePresupuesto: presupuesto.haAlcanzadoLimite(
        huboCambio ? tokensFinales : tokensIniciales,
      ),
      etapaAplicada,
      tokensRecuperados,
      porcentajeUso: presupuesto.porcentajeSobreLimite(
        huboCambio ? tokensFinales : tokensIniciales,
      ),
      avisoUmbral: Math.round(porcentajeInicial),
    }
  } catch (error) {
    return {
      mensajes,
      ultimoTokens,
      recortado: false,
      podado: false,
      resumido: false,
      compactado: false,
      excedePresupuesto: presupuesto.haAlcanzadoLimite(tokensIniciales),
      etapaAplicada: 'ninguna',
      tokensRecuperados: 0,
      porcentajeUso: porcentajeInicial,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
