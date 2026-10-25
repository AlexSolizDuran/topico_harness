import { isAbsolute, relative, resolve } from 'node:path'
import type {
  AccionPermiso,
  AccionPermisoCanon,
  EfectoPermiso,
  ReglaPermiso,
} from '../types.js'

export const REGLAS_BASE: readonly ReglaPermiso[] = [
  { accion: '*', recurso: '*', efecto: 'permitir' },
  { accion: 'read', recurso: '*.env', efecto: 'consultar' },
  { accion: 'read', recurso: '*.env.*', efecto: 'consultar' },
  { accion: 'read', recurso: '*.env.example', efecto: 'permitir' },
]

const MAPA_ACCIONES: Record<string, AccionPermisoCanon | '*'> = {
  '*': '*',
  read: 'read',
  leer: 'read',
  glob: 'glob',
  buscar_archivos: 'glob',
  'buscar archivos': 'glob',
  grep: 'grep',
  buscar_texto: 'grep',
  'buscar texto': 'grep',
  edit: 'edit',
  editar: 'edit',
  write: 'edit',
  escribir: 'edit',
  shell: 'shell',
  ejecutar: 'shell',
  bash: 'shell',
  powershell: 'shell',
  subagent: 'subagent',
  delegar: 'subagent',
  task: 'subagent',
  external_directory: 'external_directory',
  directorio_externo: 'external_directory',
  'directorio externo': 'external_directory',
}

export function normalizarAccionPermiso(
  accion: AccionPermiso | string,
): AccionPermisoCanon | '*' {
  const clave = accion.trim().toLowerCase()
  return MAPA_ACCIONES[clave] ?? 'read'
}

export function esAccionDeRuta(accion: AccionPermisoCanon | '*'): boolean {
  return (
    accion === 'read' ||
    accion === 'edit' ||
    accion === 'glob' ||
    accion === 'external_directory'
  )
}

/**
 * Normaliza separadores (`\` -> `/`) y resuelve segmentos `.` y `..`
 * para que patrones y rutas se comparen sobre la misma representación.
 */
export function normalizarRutaPermiso(ruta: string): string {
  const conBarras = ruta.trim().replace(/\\/g, '/')
  if (!conBarras) return ''

  const prefijoDrive = /^[a-zA-Z]:/.exec(conBarras)?.[0]?.toLowerCase() ?? ''
  const resto = prefijoDrive ? conBarras.slice(prefijoDrive.length) : conBarras
  const esAbsoluta = resto.startsWith('/')
  const partes = resto.split('/')
  const pila: string[] = []

  for (const parte of partes) {
    if (!parte || parte === '.') continue
    if (parte === '..') {
      if (pila.length > 0 && pila[pila.length - 1] !== '..') {
        pila.pop()
      } else if (!esAbsoluta) {
        pila.push('..')
      }
      continue
    }
    pila.push(parte)
  }

  const cuerpo = pila.join('/')
  if (prefijoDrive) {
    return `${prefijoDrive}/${cuerpo}`
  }
  if (esAbsoluta) {
    return `/${cuerpo}`
  }
  return cuerpo || '.'
}

export function esRutaFueraDelProyecto(
  ruta: string,
  directorioProyecto?: string,
): boolean {
  const normalizada = normalizarRutaPermiso(ruta)
  if (normalizada === '..' || normalizada.startsWith('../')) {
    return true
  }
  if (!directorioProyecto) {
    return isAbsolute(ruta) || /^[a-zA-Z]:[/\\]/.test(ruta)
  }
  if (isAbsolute(ruta) || /^[a-zA-Z]:[/\\]/.test(ruta)) {
    const base = resolve(directorioProyecto)
    const destino = resolve(ruta)
    const rel = relative(base, destino).replace(/\\/g, '/')
    return rel.startsWith('..') || isAbsolute(rel)
  }
  return false
}

function patronARegex(patron: string): RegExp {
  let expr = '^'
  for (const ch of patron) {
    if (ch === '*') {
      expr += '.*'
    } else if (ch === '?') {
      expr += '.'
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      expr += `\\${ch}`
    } else {
      expr += ch
    }
  }
  expr += '$'
  return new RegExp(expr)
}

/**
 * Compara el valor completo contra el patrón:
 * - `*` cubre cero o más caracteres, incluida `/`.
 * - `?` cubre exactamente un carácter.
 * - Un patrón terminado en `' *'` también coincide con el comando sin argumentos.
 */
export function coincidePatronPermiso(
  patronRaw: string,
  valorRaw: string,
  normalizarRuta = false,
): boolean {
  const patron = normalizarRuta
    ? normalizarRutaPermiso(patronRaw)
    : patronRaw.trim()
  const valor = normalizarRuta
    ? normalizarRutaPermiso(valorRaw)
    : valorRaw.trim()

  if (patron === '*') return true

  if (patron.endsWith(' *')) {
    const sinArgumentos = patron.slice(0, -2)
    if (patronARegex(sinArgumentos).test(valor)) {
      return true
    }
  }

  return patronARegex(patron).test(valor)
}

export function coincideReglaPermiso(
  regla: ReglaPermiso,
  accion: AccionPermiso,
  recurso: string,
): boolean {
  const accionRegla = normalizarAccionPermiso(regla.accion)
  const accionBuscada = normalizarAccionPermiso(accion)

  if (accionRegla !== '*' && accionRegla !== accionBuscada) {
    return false
  }

  const usarRuta =
    esAccionDeRuta(accionBuscada) ||
    regla.recurso.includes('/') ||
    regla.recurso.includes('\\') ||
    recurso.includes('/') ||
    recurso.includes('\\')

  return coincidePatronPermiso(regla.recurso, recurso, usarRuta)
}

/**
 * Evalúa una lista ordenada de reglas para un único recurso:
 * la última regla que coincide gana; si ninguna coincide, devuelve `'consultar'`.
 */
export function evaluarReglasOrdenadas(
  accion: AccionPermiso,
  recurso: string,
  reglas: readonly ReglaPermiso[],
): EfectoPermiso {
  let ganador: EfectoPermiso | undefined
  for (const regla of reglas) {
    if (coincideReglaPermiso(regla, accion, recurso)) {
      ganador = regla.efecto
    }
  }
  return ganador ?? 'consultar'
}

export function combinarReglasPermiso(
  reglasGlobales: readonly ReglaPermiso[],
  reglasAgente: readonly ReglaPermiso[] = [],
): ReglaPermiso[] {
  return [...reglasGlobales, ...reglasAgente]
}

export interface OpcionesEvaluacionCompleta {
  accion: AccionPermiso
  recursos: string | readonly string[]
  reglasGlobales?: readonly ReglaPermiso[] | undefined
  reglasAgente?: readonly ReglaPermiso[] | undefined
  aprobacionesGuardadas?: readonly ReglaPermiso[] | undefined
  incluirBase?: boolean | undefined
  directorioProyecto?: string | undefined
}

export interface ResultadoEvaluacionPermiso {
  efecto: EfectoPermiso
  accion: AccionPermisoCanon
  recurso: string
}

function evaluarUnRecurso(
  accion: AccionPermisoCanon,
  recurso: string,
  opciones: OpcionesEvaluacionCompleta,
): EfectoPermiso {
  const incluirBase = opciones.incluirBase ?? true
  const base = incluirBase ? REGLAS_BASE : []
  const configuradas = combinarReglasPermiso(
    opciones.reglasGlobales ?? [],
    opciones.reglasAgente ?? [],
  )
  const aprobaciones = opciones.aprobacionesGuardadas ?? []

  if (
    (accion === 'read' || accion === 'edit') &&
    esRutaFueraDelProyecto(recurso, opciones.directorioProyecto)
  ) {
    const efectoExterno = evaluarReglasOrdenadas(
      'external_directory',
      recurso,
      [...base, ...configuradas],
    )
    if (efectoExterno === 'denegar') return 'denegar'
    if (efectoExterno === 'consultar') {
      const aprobado = aprobaciones.some(
        (r) =>
          r.efecto === 'permitir' &&
          coincideReglaPermiso(r, 'external_directory', recurso),
      )
      if (!aprobado) return 'consultar'
    }
  }

  const efectoConfigurado = evaluarReglasOrdenadas(accion, recurso, [
    ...base,
    ...configuradas,
  ])

  if (efectoConfigurado === 'denegar') {
    return 'denegar'
  }

  if (efectoConfigurado === 'consultar' && aprobaciones.length > 0) {
    const aprobadoSiempre = aprobaciones.some(
      (regla) =>
        regla.efecto === 'permitir' &&
        coincideReglaPermiso(regla, accion, recurso),
    )
    if (aprobadoSiempre) {
      return 'permitir'
    }
  }

  return efectoConfigurado
}

/**
 * Evalúa uno o varios recursos de una operación:
 * cualquier `denegar` deniega toda la operación; si no, cualquier `consultar` consulta.
 */
export function evaluarOperacionPermiso(
  opciones: OpcionesEvaluacionCompleta,
): ResultadoEvaluacionPermiso {
  const accionCanon = normalizarAccionPermiso(opciones.accion)
  const accion: AccionPermisoCanon = accionCanon === '*' ? 'read' : accionCanon
  const lista =
    typeof opciones.recursos === 'string'
      ? [opciones.recursos]
      : opciones.recursos.length > 0
        ? [...opciones.recursos]
        : ['*']

  let primerConsulta: string | undefined
  for (const recurso of lista) {
    const efecto = evaluarUnRecurso(accion, recurso, opciones)
    if (efecto === 'denegar') {
      return { efecto: 'denegar', accion, recurso }
    }
    if (efecto === 'consultar' && primerConsulta === undefined) {
      primerConsulta = recurso
    }
  }

  if (primerConsulta !== undefined) {
    return { efecto: 'consultar', accion, recurso: primerConsulta }
  }

  return { efecto: 'permitir', accion, recurso: lista[0] ?? '*' }
}
