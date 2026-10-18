import { validarHistorialAtomico } from '../core/history.js'
import type { Mensaje } from '../types.js'

export const ENCABEZADO_RESUMEN =
  '[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]'

/**
 * Genera un resumen factual que registra decisiones y datos concretos
 * (rutas, líneas, fallos corregidos) en lugar de descripciones narrativas.
 */
export function generarTextoResumen(mensajes: Mensaje[]): string {
  const hechos: string[] = []

  for (const m of mensajes) {
    if (m.rol === 'tool' && m.resultado) {
      // Extraer si menciona archivo y línea (ej. src/utils.ts:44)
      const matchRutaLinea = m.resultado.match(
        /([a-zA-Z0-9_\-./]+\.[a-z]+):(\d+)/,
      )
      if (matchRutaLinea?.[1] && matchRutaLinea[2]) {
        hechos.push(
          `Ubicación establecida en ${matchRutaLinea[1]}, línea ${matchRutaLinea[2]}.`,
        )
      }
    }

    if (m.contenido?.includes('corregido')) {
      hechos.push('Corrección aplicada satisfactoriamente.')
    }
  }

  const cuerpo =
    hechos.length > 0
      ? hechos.join('\n')
      : 'Decisiones y contexto previo consolidado sin narrativa.'

  return `${ENCABEZADO_RESUMEN}\n${cuerpo}`
}

/**
 * Compacta turnos antiguos del historial consolidándolos en un resumen estructurado.
 * Preserva estrictamente:
 * 1. El prompt del sistema (nunca se descarta ni se altera).
 * 2. Los turnos más recientes sin resumir.
 * 3. La atomicidad de solicitudes de herramientas y resultados.
 */
export function compactarHistorial(
  mensajes: Mensaje[],
  turnosRecientesAConservar = 1,
): Mensaje[] {
  if (mensajes.length <= 2) {
    return mensajes
  }

  // 1. Extraer prompt del sistema si existe al inicio
  const promptSistema = mensajes[0]?.rol === 'system' ? mensajes[0] : undefined
  const restoMensajes = promptSistema ? mensajes.slice(1) : mensajes

  // 2. Localizar inicios de turnos (mensajes con rol 'user')
  const indicesTurnos: number[] = []
  for (let i = 0; i < restoMensajes.length; i++) {
    if (restoMensajes[i]?.rol === 'user') {
      indicesTurnos.push(i)
    }
  }

  // Si no hay suficientes turnos para compactar, no se altera
  if (indicesTurnos.length <= turnosRecientesAConservar) {
    return mensajes
  }

  const puntoDeCorte =
    indicesTurnos[indicesTurnos.length - turnosRecientesAConservar] ??
    Math.floor(restoMensajes.length / 2)

  const mensajesAntiguos = restoMensajes.slice(0, puntoDeCorte)
  const mensajesRecientes = restoMensajes.slice(puntoDeCorte)

  // 3. Generar mensaje de resumen automático
  const resumenTexto = generarTextoResumen(mensajesAntiguos)
  const mensajeResumen: Mensaje = {
    rol: 'system',
    contenido: resumenTexto,
  }

  const nuevoHistorial: Mensaje[] = []
  if (promptSistema) {
    nuevoHistorial.push(promptSistema)
  }
  nuevoHistorial.push(mensajeResumen)
  nuevoHistorial.push(...mensajesRecientes)

  // 4. Validar que la atomicidad no haya sido violentada
  validarHistorialAtomico(nuevoHistorial)

  return nuevoHistorial
}
