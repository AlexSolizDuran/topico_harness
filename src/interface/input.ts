export interface EstadoEntrada {
  buffer: string
  cursor: number
}

export type ResultadoEntrada =
  | { tipo: 'edicion'; estado: EstadoEntrada }
  | { tipo: 'enviar'; texto: string; estado: EstadoEntrada }
  | {
      tipo: 'comando'
      comando: string
      argumentos: string
      estado: EstadoEntrada
    }
  | { tipo: 'cambiar_agente'; estado: EstadoEntrada }
  | { tipo: 'cancelar'; estado: EstadoEntrada }
  | { tipo: 'salir'; estado: EstadoEntrada }

export interface Tecla {
  return?: boolean | undefined
  backspace?: boolean | undefined
  delete?: boolean | undefined
  leftArrow?: boolean | undefined
  rightArrow?: boolean | undefined
  home?: boolean | undefined
  end?: boolean | undefined
  ctrl?: boolean | undefined
  meta?: boolean | undefined
  shift?: boolean | undefined
  tab?: boolean | undefined
  escape?: boolean | undefined
  upArrow?: boolean | undefined
  downArrow?: boolean | undefined
}

export const ENTRADA_VACIA: EstadoEntrada = { buffer: '', cursor: 0 }

function moverCursor(estado: EstadoEntrada, destino: number): EstadoEntrada {
  const cursor = Math.max(0, Math.min(estado.buffer.length, destino))
  return { buffer: estado.buffer, cursor }
}

function borrarAntes(estado: EstadoEntrada): EstadoEntrada {
  if (estado.cursor === 0) return estado
  const buffer =
    estado.buffer.slice(0, estado.cursor - 1) +
    estado.buffer.slice(estado.cursor)
  return { buffer, cursor: estado.cursor - 1 }
}

function borrarDespues(estado: EstadoEntrada): EstadoEntrada {
  if (estado.cursor >= estado.buffer.length) return estado
  const buffer =
    estado.buffer.slice(0, estado.cursor) +
    estado.buffer.slice(estado.cursor + 1)
  return { buffer, cursor: estado.cursor }
}

/** Inserta texto en la posición del cursor. Un pegado entra como una sola operación. */
export function insertarTexto(
  estado: EstadoEntrada,
  texto: string,
): EstadoEntrada {
  const limpio = texto.replace(/\r\n?/g, '\n')
  if (!limpio) return estado
  const buffer =
    estado.buffer.slice(0, estado.cursor) +
    limpio +
    estado.buffer.slice(estado.cursor)
  return { buffer, cursor: estado.cursor + limpio.length }
}

export function navegarHistorial(
  historial: string[],
  indiceActual: number | null,
  borrador: string,
  direccion: 'arriba' | 'abajo',
  textoActual: string,
): { indice: number | null; borrador: string; texto: string } {
  if (historial.length === 0) {
    return { indice: indiceActual, borrador, texto: textoActual }
  }

  if (indiceActual === null) {
    if (direccion === 'abajo') {
      return { indice: null, borrador, texto: textoActual }
    }
    const indice = historial.length - 1
    return {
      indice,
      borrador: textoActual,
      texto: historial[indice] ?? '',
    }
  }

  if (direccion === 'arriba') {
    const indice = Math.max(0, indiceActual - 1)
    return { indice, borrador, texto: historial[indice] ?? '' }
  }

  const siguiente = indiceActual + 1
  if (siguiente >= historial.length) {
    return { indice: null, borrador: '', texto: borrador }
  }
  return {
    indice: siguiente,
    borrador,
    texto: historial[siguiente] ?? '',
  }
}

export function reconocerComando(
  texto: string,
): { comando: string; argumentos: string } | undefined {
  const recortado = texto.trim()
  if (!recortado.startsWith('/')) return undefined

  const espacio = recortado.indexOf(' ')
  if (espacio === -1) {
    return { comando: recortado.slice(1), argumentos: '' }
  }
  return {
    comando: recortado.slice(1, espacio),
    argumentos: recortado.slice(espacio + 1).trim(),
  }
}

function aplicarNavegacion(
  estado: EstadoEntrada,
  tecla: Tecla,
): EstadoEntrada | undefined {
  if (tecla.backspace) return borrarAntes(estado)
  if (tecla.delete) return borrarDespues(estado)
  if (tecla.leftArrow) return moverCursor(estado, estado.cursor - 1)
  if (tecla.rightArrow) return moverCursor(estado, estado.cursor + 1)
  if (tecla.home) return moverCursor(estado, 0)
  if (tecla.end) return moverCursor(estado, estado.buffer.length)
  return undefined
}

/**
 * Traduce una tecla a una edición o a una intención. No conoce la sesión ni el
 * estado del turno: eso lo decide quien consume el resultado.
 */
export function aplicarTecla(
  estado: EstadoEntrada,
  input: string,
  tecla: Tecla = {},
): ResultadoEntrada {
  if (tecla.ctrl && input === 'c') {
    return { tipo: 'cancelar', estado }
  }
  if (tecla.ctrl && input === 'd') {
    return { tipo: 'salir', estado }
  }
  if (tecla.tab && !tecla.ctrl && !tecla.meta) {
    return { tipo: 'cambiar_agente', estado }
  }

  if ((tecla.return && tecla.shift) || (tecla.ctrl && input === 'j')) {
    return { tipo: 'edicion', estado: insertarTexto(estado, '\n') }
  }

  if (tecla.return) {
    const texto = estado.buffer.trim()
    if (!texto) {
      return { tipo: 'edicion', estado }
    }
    const comando = reconocerComando(texto)
    if (comando) {
      return {
        tipo: 'comando',
        comando: comando.comando,
        argumentos: comando.argumentos,
        estado: ENTRADA_VACIA,
      }
    }
    return { tipo: 'enviar', texto, estado: ENTRADA_VACIA }
  }

  const navegacion = aplicarNavegacion(estado, tecla)
  if (navegacion) {
    return { tipo: 'edicion', estado: navegacion }
  }

  if (input && !tecla.ctrl && !tecla.meta && !tecla.escape && !tecla.tab) {
    return { tipo: 'edicion', estado: insertarTexto(estado, input) }
  }

  return { tipo: 'edicion', estado }
}
