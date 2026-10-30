import type { Mensaje, SolicitudHerramienta } from '../types.js'

export const MARCADOR_RECORTADO =
  '[Contenido de herramienta omitido: ya procesado en un paso anterior]'

export const PREFIJO_MARCADOR_RECORTADO = '[Contenido de herramienta omitido'

export const MARCADOR_SKILL_NO_RECORTABLE = '__SKILL_NO_RECORTABLE__'

export const MINIMO_BYTES_RECORTE = 1024

export function esResultadoEnmascarado(resultado: string | undefined): boolean {
  if (!resultado) return false
  return resultado.startsWith(PREFIJO_MARCADOR_RECORTADO)
}

function formatearArgumentoRecuperacion(
  argumentos: Record<string, unknown>,
): string {
  const entradas = Object.entries(argumentos).filter(
    ([, valor]) => valor !== undefined && valor !== null,
  )
  if (entradas.length === 0) return ''

  const clavesPreferidas = [
    'ruta',
    'path',
    'archivo',
    'patron',
    'comando',
    'nombre',
    'id',
  ]
  for (const clave of clavesPreferidas) {
    const coincidencia = entradas.find(([k]) => k === clave)
    if (coincidencia) {
      return `${coincidencia[0]}=${JSON.stringify(coincidencia[1])}`
    }
  }

  return entradas
    .map(([clave, valor]) => `${clave}=${JSON.stringify(valor)}`)
    .join(', ')
}

export function construirMarcadorRecorte(
  llamada?: SolicitudHerramienta | undefined,
): string {
  if (!llamada) {
    return MARCADOR_RECORTADO
  }
  const argTexto = formatearArgumentoRecuperacion(llamada.argumentos)
  if (!argTexto) {
    return MARCADOR_RECORTADO
  }
  return `[Contenido de herramienta omitido: ya procesado en un paso anterior. Recuperable con ${llamada.nombre}(${argTexto})]`
}

function mapearLlamadasPorId(
  mensajes: Mensaje[],
): Map<string, SolicitudHerramienta> {
  const mapa = new Map<string, SolicitudHerramienta>()
  for (const msg of mensajes) {
    if (msg.rol === 'assistant' && msg.llamadasHerramientas) {
      for (const llamada of msg.llamadasHerramientas) {
        mapa.set(llamada.id, llamada)
      }
    }
  }
  return mapa
}

function obtenerIndicesUltimoPasoTool(mensajes: Mensaje[]): Set<number> {
  const protegidos = new Set<number>()
  let ultimoIndiceTool = -1
  for (let i = mensajes.length - 1; i >= 0; i--) {
    if (mensajes[i]?.rol === 'tool') {
      ultimoIndiceTool = i
      break
    }
  }
  if (ultimoIndiceTool === -1) {
    return protegidos
  }

  // Verificar si hay un mensaje assistant que agrupe la tanda final de herramientas
  let cursor = ultimoIndiceTool
  while (cursor >= 0 && mensajes[cursor]?.rol === 'tool') {
    cursor--
  }

  if (cursor >= 0 && mensajes[cursor]?.rol === 'assistant') {
    for (let i = cursor + 1; i <= ultimoIndiceTool; i++) {
      protegidos.add(i)
    }
  } else {
    protegidos.add(ultimoIndiceTool)
  }

  return protegidos
}

/**
 * Reemplaza el contenido de resultados de herramientas antiguas y grandes por una
 * marca de recorte que indica con qué herramienta y argumento recuperarlos.
 * Preserva intactos:
 * 1. Todos los mensajes del usuario.
 * 2. Todas las respuestas del modelo.
 * 3. Los resultados del último paso de herramientas (lo que el modelo acaba de ver).
 * 4. La correspondencia atómica de llamadas y respuestas.
 * 5. Los resultados marcados como no recortables (skill).
 * 6. Los resultados menores que `minimoBytes` (por defecto 1 KiB).
 */
export function recortarSalidasHerramientasViejas(
  mensajes: Mensaje[],
  minimoBytes: number = MINIMO_BYTES_RECORTE,
): Mensaje[] {
  const indicesProtegidos = obtenerIndicesUltimoPasoTool(mensajes)
  const llamadasPorId = mapearLlamadasPorId(mensajes)

  return mensajes.map((msg, index) => {
    if (msg.rol !== 'tool') {
      return msg
    }

    if (indicesProtegidos.has(index)) {
      return msg
    }

    if (msg.resultado?.includes(MARCADOR_SKILL_NO_RECORTABLE)) {
      return msg
    }

    if (esResultadoEnmascarado(msg.resultado)) {
      return msg
    }

    const bytes = Buffer.byteLength(msg.resultado ?? '', 'utf8')
    if (bytes < minimoBytes) {
      return msg
    }

    const llamada = msg.idLlamada ? llamadasPorId.get(msg.idLlamada) : undefined
    return {
      ...msg,
      resultado: construirMarcadorRecorte(llamada),
    }
  })
}
