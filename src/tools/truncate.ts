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
