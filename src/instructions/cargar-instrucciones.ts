import {
  existsSync,
  readFileSync,
  realpathSync,
  type Stats,
  statSync,
} from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { estimarTokensTexto } from '../context/tokens.js'

export const DEFAULT_TOPE_INSTRUCCIONES_BYTES = 32 * 1024
export const DEFAULT_TOPE_TOTAL_INSTRUCCIONES_BYTES = 64 * 1024

export class ErrorInstruccionesExcedidas extends Error {
  readonly ruta: string
  readonly tamanio: number
  readonly tope: number

  constructor(ruta: string, tamanio: number, tope: number) {
    super(
      `AGENTS.md excede el tope permitido: ${ruta} pesa ${tamanio} bytes, el tope es ${tope} bytes.`,
    )
    this.name = 'ErrorInstruccionesExcedidas'
    this.ruta = ruta
    this.tamanio = tamanio
    this.tope = tope
  }
}

export interface InstruccionesProyecto {
  contenido: string
  tamanioBytes: number
}

export interface InstruccionCargada {
  rutaRelativa: string
  rutaReal: string
  profundidad: number
  contenido: string
  tamanioBytes: number
  tokens: number
}

export interface OpcionesGestorInstrucciones {
  directorioProyecto: string
  topeArchivoBytes?: number | undefined
  topeTotalBytes?: number | undefined
  contenidoInicialRaiz?: string | undefined
  tamanioInicialRaiz?: number | undefined
}

export interface ResultadoExploracionInstrucciones {
  cargadas: InstruccionCargada[]
  errores: string[]
}

function resolverRealSeguro(ruta: string): string {
  try {
    return realpathSync(ruta)
  } catch {
    return resolve(ruta)
  }
}

export function cargarInstruccionesProyecto(
  directorioProyecto: string,
  topeBytes: number = DEFAULT_TOPE_INSTRUCCIONES_BYTES,
): InstruccionesProyecto | null {
  const ruta = join(directorioProyecto, 'AGENTS.md')
  let stat: Stats
  try {
    stat = statSync(ruta)
  } catch {
    return null
  }
  if (!stat.isFile()) {
    return null
  }
  const tamanioBytes = stat.size
  if (tamanioBytes > topeBytes) {
    throw new ErrorInstruccionesExcedidas(ruta, tamanioBytes, topeBytes)
  }
  const contenido = readFileSync(ruta, 'utf-8')
  if (contenido.length === 0) {
    return null
  }
  return {
    contenido,
    tamanioBytes,
  }
}

function obtenerDirectorioObjetivo(
  rutaEntrada: string,
  raizProyecto: string,
): string | undefined {
  const limpia = rutaEntrada.trim()
  if (!limpia) return undefined

  const absoluta = isAbsolute(limpia)
    ? resolve(limpia)
    : resolve(raizProyecto, limpia)

  const rel = relative(raizProyecto, absoluta).replace(/\\/g, '/')
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return undefined
  }

  try {
    if (existsSync(absoluta)) {
      return statSync(absoluta).isDirectory() ? absoluta : dirname(absoluta)
    }
  } catch {
    // Continúa abajo si no existe en disco aún.
  }

  if (limpia.endsWith('/') || !basename(absoluta).includes('.')) {
    return absoluta
  }

  return dirname(absoluta)
}

function construirAncestros(
  raizProyecto: string,
  directorioObjetivo: string,
): Array<{ dirAbs: string; relPrefix: string; profundidad: number }> {
  const rel = relative(raizProyecto, directorioObjetivo).replace(/\\/g, '/')
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return []
  }

  const resultado: Array<{
    dirAbs: string
    relPrefix: string
    profundidad: number
  }> = [{ dirAbs: raizProyecto, relPrefix: '', profundidad: 0 }]

  if (!rel || rel === '.') {
    return resultado
  }

  const segmentos = rel.split('/').filter(Boolean)
  let acumulado = ''
  for (let i = 0; i < segmentos.length; i++) {
    const seg = segmentos[i]
    if (!seg) continue
    acumulado = acumulado ? `${acumulado}/${seg}` : seg
    resultado.push({
      dirAbs: join(raizProyecto, acumulado),
      relPrefix: acumulado,
      profundidad: i + 1,
    })
  }

  return resultado
}

export class GestorInstrucciones {
  private readonly directorioProyecto: string
  private readonly raizReal: string
  private readonly topeArchivoBytes: number
  private readonly topeTotalBytes: number
  private readonly rutasRealesCargadas = new Set<string>()
  private readonly instrucciones: InstruccionCargada[] = []
  private bytesTotales = 0

  constructor(opciones: OpcionesGestorInstrucciones) {
    this.directorioProyecto = resolve(opciones.directorioProyecto)
    this.raizReal = resolverRealSeguro(this.directorioProyecto)
    this.topeArchivoBytes =
      opciones.topeArchivoBytes ?? DEFAULT_TOPE_INSTRUCCIONES_BYTES
    this.topeTotalBytes =
      opciones.topeTotalBytes ?? DEFAULT_TOPE_TOTAL_INSTRUCCIONES_BYTES

    if (opciones.contenidoInicialRaiz !== undefined) {
      if (opciones.contenidoInicialRaiz.length > 0) {
        const rutaRaiz = join(this.directorioProyecto, 'AGENTS.md')
        const rutaReal = resolverRealSeguro(rutaRaiz)
        const tamanioBytes =
          opciones.tamanioInicialRaiz ??
          Buffer.byteLength(opciones.contenidoInicialRaiz, 'utf-8')
        this.rutasRealesCargadas.add(rutaReal)
        this.bytesTotales += tamanioBytes
        this.instrucciones.push({
          rutaRelativa: 'AGENTS.md',
          rutaReal,
          profundidad: 0,
          contenido: opciones.contenidoInicialRaiz,
          tamanioBytes,
          tokens: estimarTokensTexto(opciones.contenidoInicialRaiz),
        })
      }
      return
    }

    const inicial = cargarInstruccionesProyecto(
      this.directorioProyecto,
      this.topeArchivoBytes,
    )
    if (inicial) {
      const rutaRaiz = join(this.directorioProyecto, 'AGENTS.md')
      if (inicial.tamanioBytes > this.topeTotalBytes) {
        throw new ErrorInstruccionesExcedidas(
          rutaRaiz,
          inicial.tamanioBytes,
          this.topeTotalBytes,
        )
      }
      const rutaReal = resolverRealSeguro(rutaRaiz)
      this.rutasRealesCargadas.add(rutaReal)
      this.bytesTotales += inicial.tamanioBytes
      this.instrucciones.push({
        rutaRelativa: 'AGENTS.md',
        rutaReal,
        profundidad: 0,
        contenido: inicial.contenido,
        tamanioBytes: inicial.tamanioBytes,
        tokens: estimarTokensTexto(inicial.contenido),
      })
    }
  }

  private evaluarCandidato(
    dirAbs: string,
    relPrefix: string,
    profundidad: number,
    rechazadosEnLote: Set<string>,
    cargadas: InstruccionCargada[],
    errores: string[],
  ): void {
    const candidato = join(dirAbs, 'AGENTS.md')
    let stat: Stats
    try {
      stat = statSync(candidato)
    } catch {
      return
    }
    if (!stat.isFile()) return

    const rutaReal = resolverRealSeguro(candidato)
    const relReal = relative(this.raizReal, rutaReal).replace(/\\/g, '/')
    if (relReal.startsWith('..') || isAbsolute(relReal)) {
      return
    }

    if (
      this.rutasRealesCargadas.has(rutaReal) ||
      rechazadosEnLote.has(rutaReal)
    ) {
      return
    }

    const rutaRelativa = relPrefix ? `${relPrefix}/AGENTS.md` : 'AGENTS.md'
    const tamanioBytes = stat.size

    if (tamanioBytes > this.topeArchivoBytes) {
      rechazadosEnLote.add(rutaReal)
      errores.push(
        `ERROR: El archivo de instrucciones '${rutaRelativa}' pesa ${tamanioBytes} bytes y supera el tope por archivo de ${this.topeArchivoBytes} bytes.`,
      )
      return
    }

    let contenido: string
    try {
      contenido = readFileSync(candidato, 'utf-8')
    } catch {
      return
    }
    if (contenido.length === 0) return

    if (this.bytesTotales + tamanioBytes > this.topeTotalBytes) {
      rechazadosEnLote.add(rutaReal)
      errores.push(
        `ERROR: Cargar '${rutaRelativa}' (${tamanioBytes} bytes) supera el tope total de instrucciones (${this.bytesTotales + tamanioBytes} > ${this.topeTotalBytes} bytes).`,
      )
      return
    }

    this.rutasRealesCargadas.add(rutaReal)
    this.bytesTotales += tamanioBytes
    const nueva: InstruccionCargada = {
      rutaRelativa,
      rutaReal,
      profundidad,
      contenido,
      tamanioBytes,
      tokens: estimarTokensTexto(contenido),
    }
    this.instrucciones.push(nueva)
    cargadas.push(nueva)
  }

  explorarRutas(rutas: readonly string[]): ResultadoExploracionInstrucciones {
    const cargadas: InstruccionCargada[] = []
    const errores: string[] = []
    const rechazadosEnLote = new Set<string>()

    for (const ruta of rutas) {
      const dirObjetivo = obtenerDirectorioObjetivo(
        ruta,
        this.directorioProyecto,
      )
      if (!dirObjetivo) continue

      const ancestros = construirAncestros(this.directorioProyecto, dirObjetivo)
      for (const ancestro of ancestros) {
        this.evaluarCandidato(
          ancestro.dirAbs,
          ancestro.relPrefix,
          ancestro.profundidad,
          rechazadosEnLote,
          cargadas,
          errores,
        )
      }
    }

    return { cargadas, errores }
  }

  obtenerInstruccionesOrdenadas(): InstruccionCargada[] {
    return [...this.instrucciones].sort((a, b) => a.profundidad - b.profundidad)
  }

  obtenerContenido(): string {
    return this.obtenerInstruccionesOrdenadas()
      .map((i) => i.contenido)
      .join('\n\n')
  }

  obtenerTokens(): number {
    return this.instrucciones.reduce((acc, item) => acc + item.tokens, 0)
  }

  obtenerBytesTotales(): number {
    return this.bytesTotales
  }
}
