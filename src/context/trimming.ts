import type { Mensaje } from '../types.js'

export const MARCADOR_RECORTADO =
  '[Contenido de herramienta omitido: ya procesado en un paso anterior]'

export const MARCADOR_SKILL_NO_RECORTABLE = '__SKILL_NO_RECORTABLE__'

/**
 * Reemplaza el contenido de resultados de herramientas antiguas por una marca de recorte.
 * Preserva intactos:
 * 1. Todos los mensajes del usuario.
 * 2. Todas las respuestas del modelo.
 * 3. El resultado de la herramienta más reciente (lo que el modelo acaba de ver).
 * 4. La correspondencia atómica de llamadas y respuestas.
 * 5. Los resultados marcados como no recortables (skill).
 */
export function recortarSalidasHerramientasViejas(
  mensajes: Mensaje[],
): Mensaje[] {
  // Encontrar el índice del último resultado de herramienta
  let ultimoIndiceTool = -1
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i]?.rol === 'tool') {
      ultimoIndiceTool = i
      break
    }
  }

  return mensajes.map((msg, index) => {
    // Si no es tool, se conserva íntegro (mensajes de usuario, assistant y system nunca se tocan)
    if (msg.rol !== 'tool') {
      return msg
    }

    // El último resultado de herramienta no se recorta: es lo que el modelo acaba de ver
    if (index === ultimoIndiceTool) {
      return msg
    }

    // Resultados marcados como no recortables (skill) se conservan
    if (msg.resultado?.includes(MARCADOR_SKILL_NO_RECORTABLE)) {
      return msg
    }

    // Resultados de herramientas antiguas se enmascaran preservando su idLlamada
    return {
      ...msg,
      resultado: MARCADOR_RECORTADO,
    }
  })
}
