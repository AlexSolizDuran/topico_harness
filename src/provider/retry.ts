import { ErrorProveedor } from './types.js'

export interface OpcionesReintento {
  maxIntentos?: number
  esperaInicialMs?: number
  factorMultiplicador?: number
  dormir?: (ms: number) => Promise<void>
  alReintentar?: (intento: number, esperaMs: number, error: unknown) => void
}

const DORMIR_POR_DEFECTO = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

function esCodigoEstadoTransitorio(codigo: number | undefined): boolean {
  if (codigo === undefined) return false
  return codigo === 429 || (codigo >= 500 && codigo < 600)
}

function esErrorRedTransitorio(codigoRed: string | undefined): boolean {
  return codigoRed === 'ECONNRESET' || codigoRed === 'ETIMEDOUT'
}

/**
 * Determina si un error amerita reintento (429 rate limit o 5xx server error).
 */
export function esErrorTransitorio(error: unknown): boolean {
  if (error instanceof ErrorProveedor) {
    if (error.esTransitorio) return true
    return esCodigoEstadoTransitorio(error.codigoEstado)
  }

  if (typeof error === 'object' && error !== null) {
    const err = error as { status?: number; statusCode?: number; code?: string }
    const codigo = err.status ?? err.statusCode
    if (esCodigoEstadoTransitorio(codigo)) return true
    return esErrorRedTransitorio(err.code)
  }

  return false
}

/**
 * Ejecuta una operación asíncrona aplicando retroceso exponencial para fallos transitorios.
 */
export async function ejecutarConReintentos<T>(
  operacion: (intento: number) => Promise<T>,
  opciones: OpcionesReintento = {},
): Promise<T> {
  const maxIntentos = opciones.maxIntentos ?? 3
  const esperaInicialMs = opciones.esperaInicialMs ?? 500
  const factor = opciones.factorMultiplicador ?? 2
  const dormir = opciones.dormir ?? DORMIR_POR_DEFECTO

  let ultimoError: unknown

  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      return await operacion(intento)
    } catch (error) {
      ultimoError = error

      if (!esErrorTransitorio(error) || intento >= maxIntentos) {
        throw error
      }

      const esperaMs = esperaInicialMs * factor ** (intento - 1)
      if (opciones.alReintentar) {
        opciones.alReintentar(intento, esperaMs, error)
      }

      await dormir(esperaMs)
    }
  }

  throw ultimoError
}
