import type { Mensaje } from '../types.js'

export class ErrorHistorialInvalido extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorHistorialInvalido'
  }
}

function procesarMensajeHistorial(
  mensaje: Mensaje,
  llamadasPendientes: Set<string>,
): void {
  if (mensaje.rol === 'assistant' && mensaje.llamadasHerramientas) {
    for (const llamada of mensaje.llamadasHerramientas) {
      llamadasPendientes.add(llamada.id)
    }
    return
  }

  if (mensaje.rol === 'tool') {
    const idLlamada = mensaje.idLlamada
    if (!idLlamada || !llamadasPendientes.has(idLlamada)) {
      throw new ErrorHistorialInvalido(
        `Historial inválido: resultado de herramienta sin solicitud correspondiente (id: ${idLlamada ?? 'desconocido'})`,
      )
    }
    llamadasPendientes.delete(idLlamada)
  }
}

/**
 * Valida que el historial sea atómico y consistente:
 * todo resultado de herramienta ('tool') debe estar precedido por el mensaje
 * del asistente ('assistant') que solicitó esa herramienta específica.
 */
export function validarHistorialAtomico(mensajes: Mensaje[]): void {
  const llamadasPendientes = new Set<string>()

  for (const mensaje of mensajes) {
    procesarMensajeHistorial(mensaje, llamadasPendientes)
  }
}

/**
 * Clona profundamente el historial para asegurar que los mensajes del usuario
 * no puedan ser mutados accidentalmente por el proceso de ejecución.
 */
export function clonarHistorial(mensajes: Mensaje[]): Mensaje[] {
  return JSON.parse(JSON.stringify(mensajes)) as Mensaje[]
}
