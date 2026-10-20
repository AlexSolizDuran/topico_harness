export type FinDeLinea = '\r\n' | '\n'

/**
 * Elige el fin de línea dominante. Un archivo mixto se normaliza al dominante
 * para no reescribirlo con dos convenciones distintas.
 */
export function detectarEol(texto: string): FinDeLinea {
  const crlf = texto.match(/\r\n/g)?.length ?? 0
  const lf = texto.match(/(?<!\r)\n/g)?.length ?? 0
  return crlf > lf ? '\r\n' : '\n'
}

export function normalizarEol(texto: string): string {
  return texto.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function restaurarEol(texto: string, eol: FinDeLinea): string {
  return eol === '\n' ? texto : texto.replace(/\n/g, '\r\n')
}
