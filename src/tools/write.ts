import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { EntradaHerramienta } from '../core/registry.js'
import { motivoAprobacionRuta, resolverRuta } from './path.js'

export function crearHerramientaEscritura(
  directorioProyecto: string = process.cwd(),
): EntradaHerramienta {
  return {
    nombre: 'write',
    descripcion:
      'Crea un nuevo archivo con el contenido proporcionado o sobrescribe por completo uno existente.',
    esquema: {
      type: 'object',
      properties: {
        ruta: {
          type: 'string',
          description: 'Ruta relativa del archivo a crear o sobrescribir',
        },
        contenido: {
          type: 'string',
          description: 'Contenido completo de texto a escribir',
        },
      },
      required: ['ruta', 'contenido'],
    },
    accionPermiso: 'edit',
    obtenerRecurso: (args) => String(args.ruta ?? ''),
    motivoAprobacionObligatoria: (args) =>
      motivoAprobacionRuta(String(args.ruta ?? ''), directorioProyecto),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const ruta = String(args.ruta ?? '')
      const contenido = String(args.contenido ?? '')
      const rutaAbsoluta = resolverRuta(ruta, directorioProyecto)

      // Crear directorios padres si no existen
      await mkdir(dirname(rutaAbsoluta), { recursive: true })
      await writeFile(rutaAbsoluta, contenido, 'utf-8')

      return `Archivo guardado exitosamente: ${ruta} (${contenido.length} caracteres)`
    },
  }
}
