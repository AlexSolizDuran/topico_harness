export const MAXIMO_CONTENIDO_POR_DEFECTO = 30000

/**
 * Trunca una cadena de texto al tamaño máximo configurado (30.000 caracteres por defecto),
 * agregando un indicador explícito si ocurrió truncamiento.
 */
export function truncarContenido(
  contenido: string,
  maximo: number = MAXIMO_CONTENIDO_POR_DEFECTO,
): string {
  if (contenido.length <= maximo) {
    return contenido
  }

  const recorte = contenido.slice(0, maximo)
  return `${recorte}\n\n[Contenido truncado. Se mostraron ${maximo} de ${contenido.length} caracteres]`
}

/**
 * Entrega la salida de comandos largos como cola (tail) de los últimos N caracteres,
 * precedida por una marca que indica la cantidad de caracteres omitidos y que la salida
 * completa se encuentra preservada en la interfaz.
 */
export function formatearColaSalida(
  salida: string,
  maximo: number = MAXIMO_CONTENIDO_POR_DEFECTO,
): { cola: string; completa: string; truncada: boolean; omitidos: number } {
  if (salida.length <= maximo) {
    return {
      cola: salida,
      completa: salida,
      truncada: false,
      omitidos: 0,
    }
  }

  const omitidos = salida.length - maximo
  const cola = salida.slice(-maximo)
  const marca = `[... ${omitidos} caracteres omitidos. La salida completa está disponible en la interfaz ...]\n`
  return {
    cola: `${marca}${cola}`,
    completa: salida,
    truncada: true,
    omitidos,
  }
}
