import type { ConteoTokens, Mensaje } from '../types.js'
import type { PresupuestoContexto } from './budget.js'
import { compactarHistorial } from './compaction.js'
import { calcularTokensHistorial } from './tokens.js'
import { recortarSalidasHerramientasViejas } from './trimming.js'

export interface ResultadoPipeline {
  mensajes: Mensaje[]
  ultimoTokens?: ConteoTokens | undefined
  recortado: boolean
  compactado: boolean
  excedePresupuesto: boolean
  error?: string | undefined
}

const MAXIMO_COMPACTACIONES = 8

/**
 * Se ejecuta al final del turno. Primero recorta lo barato y solo resume si el
 * recorte no alcanza. Repite la compactación mientras haya progreso; si no puede
 * bajar del límite, lo informa sin romper el turno ya terminado.
 */
export function aplicarPipelineContexto(
  mensajes: Mensaje[],
  presupuesto: PresupuestoContexto,
  ultimoTokens?: ConteoTokens | undefined,
): ResultadoPipeline {
  try {
    const medicion = calcularTokensHistorial(mensajes, ultimoTokens)
    if (!presupuesto.estaCercaDelLimite(medicion.tokens)) {
      return {
        mensajes,
        ultimoTokens,
        recortado: false,
        compactado: false,
        excedePresupuesto: false,
      }
    }

    const recortados = recortarSalidasHerramientasViejas(mensajes)
    const recortado = recortados.some(
      (mensaje, indice) => mensaje !== mensajes[indice],
    )

    let actuales = recortados
    let compactado = false
    let iteraciones = 0
    let recientesAConservar = 2

    while (
      presupuesto.haAlcanzadoLimite(calcularTokensHistorial(actuales).tokens) &&
      iteraciones < MAXIMO_COMPACTACIONES
    ) {
      const siguientes = compactarHistorial(actuales, recientesAConservar)
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

    return {
      mensajes: actuales,
      ultimoTokens: undefined,
      recortado,
      compactado,
      excedePresupuesto: presupuesto.haAlcanzadoLimite(
        calcularTokensHistorial(actuales).tokens,
      ),
    }
  } catch (error) {
    return {
      mensajes,
      ultimoTokens,
      recortado: false,
      compactado: false,
      excedePresupuesto: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
