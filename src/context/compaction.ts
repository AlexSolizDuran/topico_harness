import { validarHistorialAtomico } from '../core/history.js'
import type { Mensaje } from '../types.js'

export const ENCABEZADO_RESUMEN =
  '[RESUMEN GENERADO AUTOMÁTICAMENTE - NO SON HECHOS VERIFICADOS]'

export const MINIMO_BYTES_BLOQUE_RESUMEN = 64

export type GeneradorResumen = (mensajes: Mensaje[]) => string

export interface OpcionesResumenBloque {
  minimoBytesBloque?: number | undefined
  generadorResumen?: GeneradorResumen | undefined
}

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

function extraerHechosDeMensaje(hechos: Set<string>, m: Mensaje): void {
  if (esResumenAutomatico(m) && m.contenido) {
    const cuerpo = m.contenido.slice(ENCABEZADO_RESUMEN.length).trim()
    for (const linea of cuerpo.split('\n')) {
      agregarHecho(hechos, linea)
    }
    return
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

/**
 * Genera un resumen factual que registra decisiones y datos concretos
 * (rutas, líneas, fallos corregidos) en lugar de descripciones narrativas.
 * Si recibe un resumen anterior, conserva sus hechos para no perderlos al
 * reemplazarlo.
 */
export function generarTextoResumen(mensajes: Mensaje[]): string {
  const hechos = new Set<string>()
  for (const m of mensajes) {
    extraerHechosDeMensaje(hechos, m)
  }

  const cuerpo =
    hechos.size > 0
      ? [...hechos].join('\n')
      : 'Decisiones y contexto previo consolidado sin narrativa.'

  return `${ENCABEZADO_RESUMEN}\n${cuerpo}`
}

function separarEncabezadoHistorial(mensajes: Mensaje[]): {
  promptSistema?: Mensaje | undefined
  resumenesPrevios: Mensaje[]
  restoMensajes: Mensaje[]
  indicesTurnos: number[]
} {
  const resumenesPrevios = mensajes.filter(esResumenAutomatico)
  const primerMensaje = mensajes[0]
  const promptSistema =
    primerMensaje?.rol === 'system' && !esResumenAutomatico(primerMensaje)
      ? primerMensaje
      : undefined

  const restoMensajes = mensajes.filter(
    (mensaje) => mensaje !== promptSistema && !esResumenAutomatico(mensaje),
  )

  const indicesTurnos: number[] = []
  for (let i = 0; i < restoMensajes.length; i++) {
    if (restoMensajes[i]?.rol === 'user') {
      indicesTurnos.push(i)
    }
  }

  return { promptSistema, resumenesPrevios, restoMensajes, indicesTurnos }
}

function calcularBytesBloque(bloque: Mensaje[]): number {
  let total = 0
  for (const m of bloque) {
    if (m.contenido) total += Buffer.byteLength(m.contenido, 'utf8')
    if (m.resultado) total += Buffer.byteLength(m.resultado, 'utf8')
  }
  return total
}

/**
 * En el umbral de resumen (90%), resume únicamente el bloque (turno) más antiguo
 * que supere el tamaño mínimo y conserva el resto de los bloques intermedios y
 * recientes intactos. Reemplaza el resumen automático anterior si existía.
 */
export function resumirBloqueMasAntiguo(
  mensajes: Mensaje[],
  opciones: OpcionesResumenBloque = {},
): Mensaje[] {
  if (mensajes.length <= 2) {
    return mensajes
  }

  const { promptSistema, resumenesPrevios, restoMensajes, indicesTurnos } =
    separarEncabezadoHistorial(mensajes)

  if (indicesTurnos.length < 2) {
    return mensajes
  }

  const minimoBytes = opciones.minimoBytesBloque ?? 0
  const generador = opciones.generadorResumen ?? generarTextoResumen

  // Buscar el bloque más antiguo (antes del último turno) que supere minimoBytes
  let indiceTurnoElegido = -1
  for (let t = 0; t < indicesTurnos.length - 1; t++) {
    const inicio = indicesTurnos[t] ?? 0
    const fin = indicesTurnos[t + 1] ?? restoMensajes.length
    const bloque = restoMensajes.slice(inicio, fin)
    if (calcularBytesBloque(bloque) >= minimoBytes) {
      indiceTurnoElegido = t
      break
    }
  }

  if (indiceTurnoElegido === -1) {
    return mensajes
  }

  const inicioBloque = indicesTurnos[indiceTurnoElegido] ?? 0
  const finBloque =
    indicesTurnos[indiceTurnoElegido + 1] ?? restoMensajes.length
  const bloqueAResumir = restoMensajes.slice(inicioBloque, finBloque)
  const restantes = [
    ...restoMensajes.slice(0, inicioBloque),
    ...restoMensajes.slice(finBloque),
  ]

  const resumenTexto = generador([...resumenesPrevios, ...bloqueAResumir])
  if (!resumenTexto || resumenTexto.trim().length === 0) {
    throw new Error('No se pudo generar el resumen del bloque más antiguo.')
  }

  const mensajeResumen: Mensaje = {
    rol: 'system',
    contenido: resumenTexto,
  }

  const nuevoHistorial: Mensaje[] = []
  if (promptSistema) {
    nuevoHistorial.push(promptSistema)
  }
  nuevoHistorial.push(mensajeResumen)
  nuevoHistorial.push(...restantes)

  validarHistorialAtomico(nuevoHistorial)
  return nuevoHistorial
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
  generadorResumen: GeneradorResumen = generarTextoResumen,
): Mensaje[] {
  if (mensajes.length <= 2) {
    return mensajes
  }

  const { promptSistema, resumenesPrevios, restoMensajes, indicesTurnos } =
    separarEncabezadoHistorial(mensajes)

  // Si no hay suficientes turnos para compactar, no se altera.
  if (indicesTurnos.length <= turnosRecientesAConservar) {
    return mensajes
  }

  const puntoDeCorte =
    indicesTurnos[indicesTurnos.length - turnosRecientesAConservar] ??
    Math.floor(restoMensajes.length / 2)

  const mensajesAntiguos = restoMensajes.slice(0, puntoDeCorte)
  const mensajesRecientes = restoMensajes.slice(puntoDeCorte)

  // Generar un único mensaje de resumen automático, conservando los hechos
  // de resúmenes anteriores.
  const resumenTexto = generadorResumen([
    ...resumenesPrevios,
    ...mensajesAntiguos,
  ])
  if (!resumenTexto || resumenTexto.trim().length === 0) {
    throw new Error('No se pudo generar el resumen del historial.')
  }

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

  validarHistorialAtomico(nuevoHistorial)

  return nuevoHistorial
}
