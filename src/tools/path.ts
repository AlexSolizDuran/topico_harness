import { realpathSync } from 'node:fs'
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'node:path'
import { esRutaSensible } from './ignore.js'

export class ErrorRutaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorRutaInvalida'
  }
}

export interface ApiRutas {
  resolve: (...rutas: string[]) => string
  relative: (desde: string, hasta: string) => string
  isAbsolute: (ruta: string) => boolean
  dirname: (ruta: string) => string
  basename: (ruta: string) => string
  join: (...rutas: string[]) => string
}

export const RUTAS_NODE: ApiRutas = {
  resolve,
  relative,
  isAbsolute,
  dirname,
  basename,
  join,
}

function verificarDentro(
  absoluta: string,
  base: string,
  pathApi: ApiRutas,
  rutaOriginal: string,
): void {
  const relativa = pathApi.relative(base, absoluta)
  if (relativa === '') return
  if (relativa.startsWith('..') || pathApi.isAbsolute(relativa)) {
    throw new ErrorRutaInvalida(
      `Ruta fuera del proyecto no permitida: '${rutaOriginal}'`,
    )
  }
}

/**
 * Resuelve un symlink si existe; para una ruta nueva resuelve el ancestro
 * existente más cercano y le vuelve a colgar los tramos pendientes.
 */
function resolverRutaReal(rutaAbsoluta: string, pathApi: ApiRutas): string {
  const pendientes: string[] = []
  let actual = rutaAbsoluta

  while (true) {
    try {
      const real = realpathSync(actual)
      return pendientes.length === 0
        ? real
        : pathApi.join(real, ...pendientes.reverse())
    } catch {
      const padre = pathApi.dirname(actual)
      if (padre === actual) return rutaAbsoluta
      pendientes.push(pathApi.basename(actual))
      actual = padre
    }
  }
}

function realpathSeguro(ruta: string): string {
  try {
    return realpathSync(ruta)
  } catch {
    return ruta
  }
}

/**
 * Resuelve una ruta asegurando que apunte al interior del proyecto.
 * `pathApi` permite probar el comportamiento de Windows desde Linux.
 */
export function resolverRutaSegura(
  rutaEntrada: string,
  directorioProyecto: string = process.cwd(),
  pathApi: ApiRutas = RUTAS_NODE,
): string {
  const base = pathApi.resolve(directorioProyecto)
  const absoluta = pathApi.isAbsolute(rutaEntrada)
    ? pathApi.resolve(rutaEntrada)
    : pathApi.resolve(base, rutaEntrada)

  verificarDentro(absoluta, base, pathApi, rutaEntrada)

  const relativa = pathApi.relative(base, absoluta).replace(/\\/g, '/')
  if (esRutaSensible(relativa)) {
    throw new ErrorRutaInvalida(`Ruta protegida: '${rutaEntrada}'`)
  }

  const baseReal = realpathSeguro(base)
  const absolutaReal = resolverRutaReal(absoluta, pathApi)
  verificarDentro(absolutaReal, baseReal, pathApi, rutaEntrada)

  return absoluta
}
