import type { ConteoTokens, Mensaje } from '../types.js'

export interface MedicionTokens {
  tokens: number
  esEstimado: boolean
}

/**
 * Estima tokens de forma conservadora a partir del texto (length / 4 redondeado hacia arriba).
 */
export function estimarTokensTexto(texto: string): number {
  if (!texto) return 0
  return Math.ceil(texto.length / 4)
}

/**
 * Calcula la cantidad de tokens de un conjunto de mensajes, priorizando el reporte
 * exacto del provider cuando existe y recurriendo a la estimación conservadora con aviso de inexactitud.
 */
export function calcularTokensHistorial(
  mensajes: Mensaje[],
  ultimoConteoProvider?: ConteoTokens | undefined,
): MedicionTokens {
  if (ultimoConteoProvider) {
    return {
      tokens: ultimoConteoProvider.entrada + ultimoConteoProvider.salida,
      esEstimado: false,
    }
  }

  let totalCaracteres = 0
  for (const m of mensajes) {
    totalCaracteres += m.contenido?.length ?? 0
    totalCaracteres += m.resultado?.length ?? 0
    if (m.llamadasHerramientas) {
      for (const llamada of m.llamadasHerramientas) {
        totalCaracteres +=
          llamada.nombre.length + JSON.stringify(llamada.argumentos).length
      }
    }
  }

  return {
    tokens: estimarTokensTexto('x'.repeat(totalCaracteres)),
    esEstimado: true,
  }
}
