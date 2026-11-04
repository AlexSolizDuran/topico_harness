import type { EntradaMemoria } from './types.js'

/**
 * Resuelve contradicciones entre entradas de memoria.
 * Cuando dos entradas tratan sobre el mismo tema o clave pero expresan hechos incompatibles,
 * marca la más antigua como superada y obsoleta.
 */
export function resolverContradicciones(
  entradas: EntradaMemoria[],
): EntradaMemoria[] {
  const mapaPorClave = new Map<string, EntradaMemoria>()
  const resultado: EntradaMemoria[] = []

  for (const entrada of entradas) {
    const clave = normalizarClave(entrada.titulo)
    const existente = mapaPorClave.get(clave)

    if (existente) {
      // Contradicción detectada: la más reciente supera a la más vieja
      const fechaExistente = existente.fecha
        ? new Date(existente.fecha).getTime()
        : 0
      const fechaEntrada = entrada.fecha ? new Date(entrada.fecha).getTime() : 0

      if (fechaEntrada >= fechaExistente) {
        existente.obsoleta = true
        existente.superadaPor = entrada.id
        mapaPorClave.set(clave, entrada)
      } else {
        entrada.obsoleta = true
        entrada.superadaPor = existente.id
      }
    } else {
      mapaPorClave.set(clave, entrada)
    }
    resultado.push(entrada)
  }

  return resultado
}

function normalizarClave(titulo: string): string {
  return titulo
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim()
    .slice(0, 40)
}
