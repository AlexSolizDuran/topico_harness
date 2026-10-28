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

export interface RiesgoRuta {
  fueraDelProyecto: boolean
  sensible: boolean
}

function esFuera(relativa: string, pathApi: ApiRutas): boolean {
  return (
    relativa === '..' ||
    relativa.startsWith('../') ||
    pathApi.isAbsolute(relativa)
  )
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
 * Resuelve una ruta a absoluta sin restricciones. La decisión de permitir una
 * ruta fuera del proyecto o sensible la toma el portero, no esta función.
 */
export function resolverRuta(
  rutaEntrada: string,
  directorioProyecto: string = process.cwd(),
  pathApi: ApiRutas = RUTAS_NODE,
): string {
  const base = pathApi.resolve(directorioProyecto)
  return pathApi.isAbsolute(rutaEntrada)
    ? pathApi.resolve(rutaEntrada)
    : pathApi.resolve(base, rutaEntrada)
}

/**
 * Clasifica una ruta para que la herramienta pueda declarar un motivo de
 * aprobación obligatoria. Sigue symlinks: una ruta que parece interna pero
 * resuelve fuera del proyecto cuenta como externa.
 */
export function evaluarRiesgoRuta(
  rutaEntrada: string,
  directorioProyecto: string = process.cwd(),
  pathApi: ApiRutas = RUTAS_NODE,
): RiesgoRuta {
  const base = pathApi.resolve(directorioProyecto)
  const absoluta = resolverRuta(rutaEntrada, directorioProyecto, pathApi)
  const relativa = pathApi.relative(base, absoluta).replace(/\\/g, '/')
  const sensible = esRutaSensible(relativa)

  const baseReal = realpathSeguro(base)
  const absolutaReal = resolverRutaReal(absoluta, pathApi)
  const relativaReal = pathApi
    .relative(baseReal, absolutaReal)
    .replace(/\\/g, '/')

  return {
    fueraDelProyecto:
      esFuera(relativa, pathApi) || esFuera(relativaReal, pathApi),
    sensible,
  }
}

/**
 * Motivo de aprobación obligatoria para una ruta. Devuelve `undefined` cuando la
 * ruta es interna y no es sensible.
 */
export function motivoAprobacionRuta(
  rutaEntrada: string,
  directorioProyecto: string = process.cwd(),
  pathApi: ApiRutas = RUTAS_NODE,
): string | undefined {
  const riesgo = evaluarRiesgoRuta(rutaEntrada, directorioProyecto, pathApi)
  if (riesgo.fueraDelProyecto) {
    return `La ruta '${rutaEntrada}' queda fuera del proyecto.`
  }
  if (riesgo.sensible) {
    return `La ruta '${rutaEntrada}' es un archivo protegido.`
  }
  return undefined
}
