import { readFile, writeFile } from 'node:fs/promises'
import type { EntradaHerramienta } from '../core/registry.js'
import { detectarEol, normalizarEol, restaurarEol } from './eol.js'
import { motivoAprobacionRuta, resolverRuta } from './path.js'

export function crearHerramientaEdicion(
  directorioProyecto: string = process.cwd(),
): EntradaHerramienta {
  return {
    nombre: 'edit',
    descripcion:
      'Reemplaza una ocurrencia única y exacta de texto en un archivo del proyecto. Tolera diferencias entre fin de línea LF y CRLF.',
    esquema: {
      type: 'object',
      properties: {
        ruta: {
          type: 'string',
          description: 'Ruta relativa del archivo a editar',
        },
        buscar: {
          type: 'string',
          description: 'Cadena de texto exacta a buscar (debe ser única)',
        },
        reemplazar: {
          type: 'string',
          description: 'Nuevo texto de reemplazo',
        },
      },
      required: ['ruta', 'buscar', 'reemplazar'],
    },
    accionPermiso: 'edit',
    obtenerRecurso: (args) => String(args.ruta ?? ''),
    motivoAprobacionObligatoria: (args) =>
      motivoAprobacionRuta(String(args.ruta ?? ''), directorioProyecto),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const ruta = String(args.ruta ?? '')
      const buscar = String(args.buscar ?? '')
      const reemplazar = String(args.reemplazar ?? '')

      if (buscar.length === 0) {
        throw new Error('El texto a buscar no puede estar vacío.')
      }

      const rutaAbsoluta = resolverRuta(ruta, directorioProyecto)
      const contenidoOriginal = await readFile(rutaAbsoluta, 'utf-8')
      const eolOriginal = detectarEol(contenidoOriginal)

      const contenidoNormalizado = normalizarEol(contenidoOriginal)
      const buscarNormalizado = normalizarEol(buscar)
      const reemplazarNormalizado = normalizarEol(reemplazar)

      const partes = contenidoNormalizado.split(buscarNormalizado)
      const ocurrencias = partes.length - 1

      if (ocurrencias === 0) {
        throw new Error(
          `El texto a reemplazar no fue encontrado en el archivo '${ruta}'.`,
        )
      }

      if (ocurrencias > 1) {
        throw new Error(
          `El texto a reemplazar aparece ${ocurrencias} veces en el archivo '${ruta}'. Debe aparecer exactamente una vez para evitar ambigüedades.`,
        )
      }

      const nuevoContenido = restaurarEol(
        partes.join(reemplazarNormalizado),
        eolOriginal,
      )
      await writeFile(rutaAbsoluta, nuevoContenido, 'utf-8')

      return `Reemplazo aplicado exitosamente en '${ruta}'.`
    },
  }
}
