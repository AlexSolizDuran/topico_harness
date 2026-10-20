import { readFile, writeFile } from 'node:fs/promises'
import type { EntradaHerramienta } from '../core/registry.js'
import { resolverRutaSegura } from './path.js'

export function crearHerramientaEdicion(
  directorioProyecto: string = process.cwd(),
): EntradaHerramienta {
  return {
    nombre: 'edit',
    descripcion:
      'Reemplaza una ocurrencia única y exacta de texto en un archivo del proyecto.',
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
    ejecutar: async (args) => {
      const ruta = String(args.ruta ?? '')
      const buscar = String(args.buscar ?? '')
      const reemplazar = String(args.reemplazar ?? '')

      const rutaAbsoluta = resolverRutaSegura(ruta, directorioProyecto)
      const contenidoOriginal = await readFile(rutaAbsoluta, 'utf-8')

      const partes = contenidoOriginal.split(buscar)
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

      const nuevoContenido = partes.join(reemplazar)
      await writeFile(rutaAbsoluta, nuevoContenido, 'utf-8')

      return `Reemplazo aplicado exitosamente en '${ruta}'.`
    },
  }
}
