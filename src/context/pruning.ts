import { validarHistorialAtomico } from '../core/history.js'
import type { Mensaje } from '../types.js'
import { esResultadoEnmascarado } from './trimming.js'

export const HERRAMIENTAS_SOLO_LECTURA_PODA: ReadonlySet<string> = new Set([
  'read',
  'glob',
  'grep',
  'skill',
])

function esResultadoEnmascaradoOVacio(resultado: string | undefined): boolean {
  if (!resultado || resultado.trim().length === 0) {
    return true
  }
  return esResultadoEnmascarado(resultado)
}

function esPasoSoloLecturaPodable(
  msgAssistant: Mensaje,
  respuestasTool: Mensaje[],
): boolean {
  // No podar si el modelo produjo texto en ese paso
  if (msgAssistant.contenido && msgAssistant.contenido.trim().length > 0) {
    return false
  }

  const llamadas = msgAssistant.llamadasHerramientas
  if (!llamadas || llamadas.length === 0) {
    return false
  }

  // Verificar que todas las llamadas sean de solo lectura
  if (!llamadas.every((l) => HERRAMIENTAS_SOLO_LECTURA_PODA.has(l.nombre))) {
    return false
  }

  // Verificar correspondencia atómica 1-a-1 con las respuestas del paso
  if (respuestasTool.length !== llamadas.length) {
    return false
  }

  const idsEsperados = new Set(llamadas.map((l) => l.id))
  for (const resp of respuestasTool) {
    if (!resp.idLlamada || !idsEsperados.has(resp.idLlamada)) {
      return false
    }
    if (!esResultadoEnmascaradoOVacio(resp.resultado)) {
      return false
    }
  }

  return true
}

/**
 * Elimina pasos antiguos cuyas únicas llamadas sean de solo lectura, cuyos
 * resultados ya estén enmascarados o vacíos y donde el modelo no haya producido
 * texto. Preserva intactos los mensajes del usuario, el paso en curso y la
 * correspondencia atómica llamada-respuesta.
 */
export function podarPasosLectura(mensajes: Mensaje[]): Mensaje[] {
  const indicesAEliminar = new Set<number>()

  let i = 0
  while (i < mensajes.length) {
    const msg = mensajes[i]
    if (
      msg?.rol !== 'assistant' ||
      !msg.llamadasHerramientas ||
      msg.llamadasHerramientas.length === 0
    ) {
      i++
      continue
    }

    let finPaso = i + 1
    const respuestas: Mensaje[] = []
    while (finPaso < mensajes.length && mensajes[finPaso]?.rol === 'tool') {
      const toolMsg = mensajes[finPaso]
      if (toolMsg) {
        respuestas.push(toolMsg)
      }
      finPaso++
    }

    // Si finPaso llega al final del arreglo, este es el paso en curso y nunca se poda
    const esPasoEnCurso = finPaso >= mensajes.length
    if (!esPasoEnCurso && esPasoSoloLecturaPodable(msg, respuestas)) {
      for (let k = i; k < finPaso; k++) {
        indicesAEliminar.add(k)
      }
    }

    i = finPaso
  }

  if (indicesAEliminar.size === 0) {
    return mensajes
  }

  const resultado = mensajes.filter((_, idx) => !indicesAEliminar.has(idx))
  validarHistorialAtomico(resultado)
  return resultado
}
