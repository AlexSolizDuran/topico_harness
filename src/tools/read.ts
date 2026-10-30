import { readFile } from 'node:fs/promises'
import type { EntradaHerramienta } from '../core/registry.js'
import { motivoAprobacionRuta, resolverRuta } from './path.js'
import { truncarContenido } from './truncate.js'

export function crearHerramientaLectura(
  directorioProyecto: string = process.cwd(),
  maximoContenido?: number,
): EntradaHerramienta {
  return {
    nombre: 'read',
    descripcion:
      'Lee el contenido de un archivo del proyecto, opcionalmente delimitado por un tramo de líneas.',
    esquema: {
      type: 'object',
      properties: {
        ruta: {
          type: 'string',
          description: 'Ruta relativa del archivo a leer',
        },
        inicio: {
          type: 'number',
          description: 'Número de línea inicial (1-indexado)',
        },
        fin: {
          type: 'number',
          description: 'Número de línea final (1-indexado, inclusive)',
        },
      },
      required: ['ruta'],
    },
    accionPermiso: 'read',
    obtenerRecurso: (args) => String(args.ruta ?? ''),
    rutasExploradas: (args) => {
      const ruta = typeof args.ruta === 'string' ? args.ruta.trim() : ''
      return ruta ? [ruta] : []
    },
    motivoAprobacionObligatoria: (args) =>
      motivoAprobacionRuta(String(args.ruta ?? ''), directorioProyecto),
    admiteParalelo: true,
    ejecutar: async (args) => {
      const ruta = String(args.ruta ?? '')
      const rutaAbsoluta = resolverRuta(ruta, directorioProyecto)

      const contenidoCompleto = await readFile(rutaAbsoluta, 'utf-8')

      const inicio = typeof args.inicio === 'number' ? args.inicio : undefined
      const fin = typeof args.fin === 'number' ? args.fin : undefined

      if (inicio !== undefined || fin !== undefined) {
        const lineas = contenidoCompleto.split(/\r?\n/)
        const lineaDesde = Math.max(1, inicio ?? 1) - 1
        const lineaHasta =
          fin !== undefined ? Math.min(lineas.length, fin) : lineas.length
        const tramo = lineas.slice(lineaDesde, lineaHasta).join('\n')
        return truncarContenido(tramo, maximoContenido)
      }

      return truncarContenido(contenidoCompleto, maximoContenido)
    },
  }
}
