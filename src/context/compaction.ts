import { validarHistorialAtomico } from '../core/history.js'
import type { Mensaje } from '../types.js'

export const ENCABEZADO_RESUMEN =
  '[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]'

/** Un resumen anterior se reemplaza, nunca se apila. */
export function esResumenAutomatico(mensaje: Mensaje): boolean {
  return (
    mensaje.rol === 'system' &&
    (mensaje.contenido?.startsWith(ENCABEZADO_RESUMEN) ?? false)
  )
}

function agregarHecho(hechos: Set<string>, texto: string): void {
  const limpio = texto.trim()
  if (limpio) hechos.add(limpio)
}

/**
 * Genera un resumen factual que registra decisiones y datos concretos
 * (rutas, líneas, fallos corregidos) en lugar de descripciones narrativas.
 * Si recibe un resumen anterior, conserva sus hechos para no perderlos al
 * reemplazarlo.
 */
export function generarTextoResumen(mensajes: Mensaje[]): string {
  const hechos = new Set<string>()

  for (const m of mensajes) {
    if (esResumenAutomatico(m) && m.contenido) {
      const cuerpo = m.contenido.slice(ENCABEZADO_RESUMEN.length).trim()
      for (const linea of cuerpo.split('\n')) {
        agregarHecho(hechos, linea)
      }
      continue
    }

    if (m.rol === 'tool' && m.resultado) {
      const matchRutaLinea = m.resultado.match(
        /([a-zA-Z0-9_\-./]+\.[a-z]+):(\d+)/,
      )
      if (matchRutaLinea?.[1] && matchRutaLinea[2]) {
        agregarHecho(
          hechos,
          `Ubicación establecida en ${matchRutaLinea[1]}, línea ${matchRutaLinea[2]}.`,
        )
      }

      const matchError = m.resultado.match(
        /^(?:ERROR|Error|error|Fallo|falló|fallo)[:\s]+(.{1,160})/m,
      )
      if (matchError?.[1]) {
        agregarHecho(hechos, `Fallo observado: ${matchError[1].trim()}`)
      }
    }

    if (m.contenido?.includes('corregido')) {
      agregarHecho(hechos, 'Corrección aplicada satisfactoriamente.')
    }
  }

  const cuerpo =
    hechos.size > 0
      ? [...hechos].join('\n')
      : 'Decisiones y contexto previo consolidado sin narrativa.'

  return `${ENCABEZADO_RESUMEN}\n${cuerpo}`
}

/**
 * Compacta turnos antiguos del historial consolidándolos en un resumen
 * estructurado. Preserva estrictamente:
 * 1. El prompt del sistema (nunca se descarta ni se altera).
 * 2. Los turnos más recientes sin resumir.
 * 3. La atomicidad de solicitudes de herramientas y resultados.
 * 4. Un solo resumen automático, reemplazando el anterior si existe.
 */
export function compactarHistorial(
  mensajes: Mensaje[],
  turnosRecientesAConservar = 1,
): Mensaje[] {
  if (mensajes.length <= 2) {
    return mensajes
  }

  // 1. Separar el prompt del sistema de los resúmenes automáticos.
  const resumenesPrevios = mensajes.filter(esResumenAutomatico)
  const primerMensaje = mensajes[0]
  const promptSistema =
    primerMensaje?.rol === 'system' && !esResumenAutomatico(primerMensaje)
      ? primerMensaje
      : undefined

  const restoMensajes = mensajes.filter(
    (mensaje) => mensaje !== promptSistema && !esResumenAutomatico(mensaje),
  )

  // 2. Localizar inicios de turnos (mensajes con rol 'user').
  const indicesTurnos: number[] = []
  for (let i = 0; i < restoMensajes.length; i++) {
    if (restoMensajes[i]?.rol === 'user') {
      indicesTurnos.push(i)
    }
  }

  // Si no hay suficientes turnos para compactar, no se altera.
  if (indicesTurnos.length <= turnosRecientesAConservar) {
    return mensajes
  }

  const puntoDeCorte =
    indicesTurnos[indicesTurnos.length - turnosRecientesAConservar] ??
    Math.floor(restoMensajes.length / 2)

  const mensajesAntiguos = restoMensajes.slice(0, puntoDeCorte)
  const mensajesRecientes = restoMensajes.slice(puntoDeCorte)

  // 3. Generar un único mensaje de resumen automático, conservando los hechos
  // de resúmenes anteriores.
  const resumenTexto = generarTextoResumen([
    ...resumenesPrevios,
    ...mensajesAntiguos,
  ])
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

  // 4. Validar que la atomicidad no haya sido violentada.
  validarHistorialAtomico(nuevoHistorial)

  return nuevoHistorial
}
