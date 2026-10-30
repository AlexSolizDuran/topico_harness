import type { Dirent } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import type { EntradaHerramienta } from '../core/registry.js'
import { debeIgnorarRuta } from './ignore.js'

function globARegex(patron: string): RegExp {
  const patronNormalizado = patron.replace(/\\/g, '/')
  const regexStr = patronNormalizado
    .replace(/[.+^${}()|[\]]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)\*/g, '[^/]*')
    .replace(/\?/g, '.')

  return new RegExp(`^${regexStr}$`)
}

function evaluarEntradaGlob(
  entrada: Dirent,
  regex: RegExp,
  directorioProyecto: string,
): string | undefined {
  if (!entrada.isFile()) return undefined

  const rutaAbsoluta = join(entrada.parentPath, entrada.name)
  const rutaRelativa = relative(directorioProyecto, rutaAbsoluta).replace(
    /\\/g,
    '/',
  )

  if (rutaRelativa.startsWith('..')) return undefined
  if (debeIgnorarRuta(rutaRelativa)) return undefined

  if (regex.test(rutaRelativa) || regex.test(entrada.name)) {
    return rutaRelativa
  }

  return undefined
}

export function extraerPrefijoDirectorioGlob(patron: string): string[] {
  const normalizado = patron
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/)+/, '')
    .trim()
  if (!normalizado || normalizado.startsWith('..')) return []

  const partes = normalizado.split('/').filter(Boolean)
  const prefijo: string[] = []
  for (let i = 0; i < partes.length; i++) {
    const segmento = partes[i]
    if (!segmento || segmento === '.') continue
    if (segmento === '..') return []
    if (/[*?[\]{}]/.test(segmento)) break
    // Si es el último segmento y no termina en barra pero parece un nombre de archivo con extensión, paramos antes
    if (
      i === partes.length - 1 &&
      !normalizado.endsWith('/') &&
      segmento.includes('.')
    ) {
      break
    }
    prefijo.push(segmento)
  }

  if (prefijo.length === 0) return []
  return [prefijo.join('/')]
}

export function crearHerramientaGlob(
  directorioProyecto: string = process.cwd(),
): EntradaHerramienta {
  return {
    nombre: 'glob',
    descripcion:
      'Encuentra rutas de archivos del proyecto que coinciden con un patrón glob.',
    esquema: {
      type: 'object',
      properties: {
        patron: {
          type: 'string',
          description: 'Patrón de búsqueda (ej. **/*.ts, src/*.json)',
        },
      },
      required: ['patron'],
    },
    accionPermiso: 'glob',
    obtenerRecurso: (args) => String(args.patron ?? '*'),
    rutasExploradas: (args) =>
      extraerPrefijoDirectorioGlob(String(args.patron ?? '')),
    admiteParalelo: true,
    ejecutar: async (args) => {
      const patron = String(args.patron ?? '')

      if (patron.startsWith('..') || patron.includes('/../')) {
        return '[]'
      }

      const regex = globARegex(patron)
      const entradas = await readdir(directorioProyecto, {
        recursive: true,
        withFileTypes: true,
      })

      const archivosCoincidentes: string[] = []

      for (const entrada of entradas) {
        const coincidencia = evaluarEntradaGlob(
          entrada,
          regex,
          directorioProyecto,
        )
        if (coincidencia) {
          archivosCoincidentes.push(coincidencia)
        }
      }

      archivosCoincidentes.sort()
      return JSON.stringify(archivosCoincidentes, null, 2)
    },
  }
}
