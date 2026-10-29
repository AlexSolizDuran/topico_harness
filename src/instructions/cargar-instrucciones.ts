import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const DEFAULT_TOPE_INSTRUCCIONES_BYTES = 32 * 1024

export class ErrorInstruccionesExcedidas extends Error {
  constructor(
    public readonly ruta: string,
    public readonly tamanio: number,
    public readonly tope: number,
  ) {
    super(
      `AGENTS.md excede el tope permitido: ${ruta} pesa ${tamanio} bytes, el tope es ${tope} bytes.`,
    )
    this.name = 'ErrorInstruccionesExcedidas'
  }
}

export interface InstruccionesProyecto {
  contenido: string
  tamanioBytes: number
}

export function cargarInstruccionesProyecto(
  directorioProyecto: string,
  topeBytes: number = DEFAULT_TOPE_INSTRUCCIONES_BYTES,
): InstruccionesProyecto | null {
  const ruta = join(directorioProyecto, 'AGENTS.md')
  let stat
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
