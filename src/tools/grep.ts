import type { Dirent } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { EntradaHerramienta } from '../core/registry.js'
import { debeIgnorarRuta } from './ignore.js'
import { truncarContenido } from './truncate.js'

function debeIgnorarEntrada(
  entrada: Dirent,
  directorioProyecto: string,
): boolean {
  const ruta = relative(
    directorioProyecto,
    join(entrada.parentPath, entrada.name),
  )
  return debeIgnorarRuta(ruta)
}

async function escanearArchivoParaGrep(
  entrada: Dirent,
  cadena: string,
  directorioProyecto: string,
  coincidencias: string[],
): Promise<void> {
  if (!entrada.isFile() || debeIgnorarEntrada(entrada, directorioProyecto)) {
    return
  }

  const rutaAbsoluta = join(entrada.parentPath, entrada.name)
  const rutaRelativa = relative(directorioProyecto, rutaAbsoluta).replace(
    /\\/g,
    '/',
  )

  try {
    const contenido = await readFile(rutaAbsoluta, 'utf-8')
    if (!contenido.includes(cadena)) return

    const lineas = contenido.split(/\r?\n/)
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i]
      if (linea?.includes(cadena)) {
        coincidencias.push(`${rutaRelativa}:${i + 1}: ${linea.trim()}`)
      }
    }
  } catch {
    // Si un archivo no se puede leer, se omite silenciosamente sin frenar la búsqueda
  }
}

export function crearHerramientaGrep(
  directorioProyecto: string = process.cwd(),
  maximoContenido?: number,
): EntradaHerramienta {
  return {
    nombre: 'grep',
    descripcion:
      'Busca una cadena de texto dentro de los archivos del proyecto y devuelve rutas y números de línea.',
    esquema: {
      type: 'object',
      properties: {
        cadena: {
          type: 'string',
          description: 'Texto literal o palabra a buscar',
        },
      },
      required: ['cadena'],
    },
    accionPermiso: 'grep',
    obtenerRecurso: (args) => String(args.cadena ?? '*'),
    admiteParalelo: true,
    ejecutar: async (args) => {
      const cadena = String(args.cadena ?? '')
      if (!cadena) {
        return 'No se especificó ninguna cadena de búsqueda.'
      }

      const entradas = await readdir(directorioProyecto, {
        recursive: true,
        withFileTypes: true,
      })

      const coincidencias: string[] = []

      for (const entrada of entradas) {
        await escanearArchivoParaGrep(
          entrada,
          cadena,
          directorioProyecto,
          coincidencias,
        )
      }

      if (coincidencias.length === 0) {
        return `No se encontraron coincidencias para: "${cadena}"`
      }

      return truncarContenido(coincidencias.join('\n'), maximoContenido)
    },
  }
}
