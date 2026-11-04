import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { type EntradaMemoria, ErrorTopeMemoria } from './types.js'

export const TOPE_ARCHIVO_MEMORIA_DEFECTO = 32 * 1024 // 32 KiB
export const TOPE_TOTAL_MEMORIA_DEFECTO = 64 * 1024 // 64 KiB

export class AlmacenMemoria {
  private directorioBase: string
  private topeArchivo: number
  private topeTotal: number

  constructor(
    directorioProyecto: string,
    opciones: { topeArchivoBytes?: number; topeTotalBytes?: number } = {},
  ) {
    this.directorioBase = join(directorioProyecto, '.harness', 'memory')
    this.topeArchivo = opciones.topeArchivoBytes ?? TOPE_ARCHIVO_MEMORIA_DEFECTO
    this.topeTotal = opciones.topeTotalBytes ?? TOPE_TOTAL_MEMORIA_DEFECTO
  }

  obtenerDirectorio(): string {
    return this.directorioBase
  }

  /**
   * Carga el índice de memoria del proyecto.
   * Si no existe el directorio o archivo, devuelve un arreglo vacío sin fallar.
   */
  cargarIndice(): EntradaMemoria[] {
    const rutaIndice = join(this.directorioBase, 'index.md')
    if (!existsSync(rutaIndice)) {
      return []
    }

    try {
      const contenido = readFileSync(rutaIndice, 'utf-8')
      return this.parsearIndiceMarkdown(contenido)
    } catch {
      return []
    }
  }

  /**
   * Carga el detalle de una entrada de memoria bajo demanda.
   */
  cargarDetalle(id: string): string | undefined {
    const rutaDetalle = join(this.directorioBase, `${id}.md`)
    if (!existsSync(rutaDetalle)) {
      return undefined
    }

    try {
      return readFileSync(rutaDetalle, 'utf-8')
    } catch {
      return undefined
    }
  }

  /**
   * Guarda de forma atómica el índice y los detalles correspondientes.
   * Valida estrictamente los topes por archivo y total. Si se supera cualquier
   * tope, lanza ErrorTopeMemoria y no escribe nada.
   */
  guardarEntradas(entradas: EntradaMemoria[]): void {
    const contenidoIndice = this.serializarIndiceMarkdown(entradas)
    const tamanioIndice = Buffer.byteLength(contenidoIndice, 'utf-8')

    if (tamanioIndice > this.topeArchivo) {
      throw new ErrorTopeMemoria('index.md', tamanioIndice, this.topeArchivo)
    }

    let tamanioTotal = tamanioIndice
    const archivosAEscribir: Array<{ ruta: string; contenido: string }> = [
      {
        ruta: join(this.directorioBase, 'index.md'),
        contenido: contenidoIndice,
      },
    ]

    for (const entrada of entradas) {
      if (entrada.contenido) {
        const nombreArchivo = `${entrada.id}.md`
        const tamanioDetalle = Buffer.byteLength(entrada.contenido, 'utf-8')
        if (tamanioDetalle > this.topeArchivo) {
          throw new ErrorTopeMemoria(
            nombreArchivo,
            tamanioDetalle,
            this.topeArchivo,
          )
        }
        tamanioTotal += tamanioDetalle
        archivosAEscribir.push({
          ruta: join(this.directorioBase, nombreArchivo),
          contenido: entrada.contenido,
        })
      }
    }

    if (tamanioTotal > this.topeTotal) {
      throw new ErrorTopeMemoria('total_memoria', tamanioTotal, this.topeTotal)
    }

    // Escritura atómica
    if (!existsSync(this.directorioBase)) {
      mkdirSync(this.directorioBase, { recursive: true })
    }

    for (const archivo of archivosAEscribir) {
      writeFileSync(archivo.ruta, archivo.contenido, 'utf-8')
    }
  }

  private parsearIndiceMarkdown(markdown: string): EntradaMemoria[] {
    const entradas: EntradaMemoria[] = []
    const lineas = markdown.split('\n')

    for (const linea of lineas) {
      const recortada = linea.trim()
      if (!recortada.startsWith('- [') && !recortada.startsWith('* [')) continue

      // Formato: - [id] (fecha | origen: X) Titulo ~~[obsoleta]~~
      const match = recortada.match(
        /^[-*]\s*\[([^\]]+)\](?:\s*\(([^)]+)\))?\s*(.+)$/,
      )
      if (match) {
        const id = match[1]?.trim() ?? ''
        const meta = match[2]?.trim() ?? ''
        let titulo = match[3]?.trim() ?? ''

        let fecha: string | undefined
        let origen: string | undefined
        if (meta) {
          const partes = meta.split('|').map((p) => p.trim())
          for (const parte of partes) {
            if (parte.startsWith('origen:')) {
              origen = parte.replace('origen:', '').trim()
            } else if (/\d{4}-\d{2}-\d{2}/.test(parte)) {
              fecha = parte
            }
          }
        }

        let obsoleta = false
        if (titulo.includes('[obsoleta]') || titulo.startsWith('~~')) {
          obsoleta = true
          titulo = titulo.replace(/~~/g, '').replace('[obsoleta]', '').trim()
        }

        entradas.push({
          id,
          titulo,
          contenido: '',
          fecha,
          origen,
          obsoleta,
        })
      }
    }

    return entradas
  }

  private serializarIndiceMarkdown(entradas: EntradaMemoria[]): string {
    const lineas: string[] = ['# Índice de Memoria del Proyecto\n']
    for (const entrada of entradas) {
      const metaPartes: string[] = []
      if (entrada.fecha) metaPartes.push(entrada.fecha)
      if (entrada.origen) metaPartes.push(`origen: ${entrada.origen}`)
      const meta = metaPartes.length > 0 ? ` (${metaPartes.join(' | ')})` : ''

      const titulo = entrada.obsoleta
        ? `~~${entrada.titulo}~~ [obsoleta]`
        : entrada.titulo

      lineas.push(`- [${entrada.id}]${meta} ${titulo}`)
    }
    return lineas.join('\n')
  }
}
