import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  AccionPermiso,
  DecisionAprobacion,
  EfectoPermiso,
  EvaluacionPermiso,
  PorteroPermisos,
  ReglaPermiso,
  SolicitudAprobacion,
} from '../types.js'
import {
  evaluarOperacionPermiso,
  normalizarAccionPermiso,
  normalizarRutaPermiso,
} from './reglas.js'

const EFECTOS_MAPA: Record<string, EfectoPermiso> = {
  permitir: 'permitir',
  allow: 'permitir',
  consultar: 'consultar',
  ask: 'consultar',
  denegar: 'denegar',
  deny: 'denegar',
}

export function rutaPermisosProyecto(directorioProyecto: string): string {
  return join(directorioProyecto, '.harness', 'permissions.json')
}

export function rutaAprobacionesProyecto(directorioProyecto: string): string {
  return join(directorioProyecto, '.harness', 'approvals.json')
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function parsearListaReglas(datos: unknown): ReglaPermiso[] {
  const listaRaw = Array.isArray(datos)
    ? datos
    : esObjeto(datos) && Array.isArray(datos.permisos)
      ? datos.permisos
      : esObjeto(datos) && Array.isArray(datos.reglas)
        ? datos.reglas
        : []

  const reglas: ReglaPermiso[] = []
  for (const item of listaRaw) {
    if (!esObjeto(item)) continue
    const accion =
      typeof item.accion === 'string'
        ? item.accion
        : typeof item.action === 'string'
          ? item.action
          : undefined
    const recurso =
      typeof item.recurso === 'string'
        ? item.recurso
        : typeof item.resource === 'string'
          ? item.resource
          : typeof item.patron === 'string'
            ? item.patron
            : undefined
    const efectoRaw =
      typeof item.efecto === 'string'
        ? item.efecto
        : typeof item.effect === 'string'
          ? item.effect
          : undefined
    const efecto = efectoRaw ? EFECTOS_MAPA[efectoRaw.toLowerCase()] : undefined

    if (accion && recurso && efecto) {
      reglas.push({
        accion: accion as AccionPermiso,
        recurso,
        efecto,
      })
    }
  }
  return reglas
}

export function cargarReglasDesdeArchivo(ruta: string): ReglaPermiso[] {
  if (!existsSync(ruta)) return []
  try {
    const texto = readFileSync(ruta, 'utf-8')
    return parsearListaReglas(JSON.parse(texto))
  } catch {
    return []
  }
}

export function cargarReglasProyecto(
  directorioProyecto: string,
): ReglaPermiso[] {
  const rutaConfig = join(directorioProyecto, '.harness', 'config.json')
  const rutaPermisos = rutaPermisosProyecto(directorioProyecto)
  return [
    ...cargarReglasDesdeArchivo(rutaConfig),
    ...cargarReglasDesdeArchivo(rutaPermisos),
  ]
}

export function cargarAprobacionesGuardadas(
  directorioProyecto: string,
): ReglaPermiso[] {
  return cargarReglasDesdeArchivo(rutaAprobacionesProyecto(directorioProyecto))
}

export function guardarReglaAprobada(
  directorioProyecto: string,
  regla: ReglaPermiso,
): void {
  const ruta = rutaAprobacionesProyecto(directorioProyecto)
  const existentes = cargarAprobacionesGuardadas(directorioProyecto)
  const yaExiste = existentes.some(
    (r) =>
      normalizarAccionPermiso(r.accion) ===
        normalizarAccionPermiso(regla.accion) &&
      r.recurso === regla.recurso &&
      r.efecto === regla.efecto,
  )
  if (!yaExiste) {
    existentes.push(regla)
  }
  mkdirSync(dirname(ruta), { recursive: true })
  writeFileSync(ruta, JSON.stringify({ reglas: existentes }, null, 2), 'utf-8')
}

export function proponerPatronPorDefecto(
  accion: AccionPermiso,
  recurso: string,
): string {
  const canon = normalizarAccionPermiso(accion)
  if (canon === 'shell' || canon === 'shell_compuesto') {
    const partes = recurso.trim().split(/\s+/).filter(Boolean)
    if (partes.length === 0) return '*'
    const prefijo = partes.slice(0, Math.min(2, partes.length)).join(' ')
    return `${prefijo} *`
  }
  if (canon === 'read' || canon === 'edit') {
    return normalizarRutaPermiso(recurso) || recurso
  }
  return recurso || '*'
}

export type ManejadorAprobacionCliente = (
  solicitud: SolicitudAprobacion,
  senalCancelacion?: AbortSignal,
) => Promise<DecisionAprobacion>

export interface OpcionesGestorPermisos {
  directorioProyecto?: string | undefined
  reglasGlobales?: ReglaPermiso[] | undefined
  reglasAgente?: ReglaPermiso[] | undefined
  aprobacionesIniciales?: ReglaPermiso[] | undefined
  incluirBase?: boolean | undefined
  esInteractivo?: boolean | undefined
  manejadorAprobacion?: ManejadorAprobacionCliente | undefined
}

interface PendienteAprobacion {
  id: string
  resolver: (decision: DecisionAprobacion) => void
}

/**
 * Coordina la evaluación de reglas, la cola de aprobaciones en espera y la
 * persistencia de aprobaciones "siempre" con alcance de proyecto.
 */
export class GestorPermisos implements PorteroPermisos {
  private directorioProyecto?: string | undefined
  private reglasGlobales: ReglaPermiso[]
  private reglasAgente: ReglaPermiso[]
  private aprobaciones: ReglaPermiso[]
  private incluirBase: boolean
  private esInteractivo: boolean
  private manejadorAprobacion?: ManejadorAprobacionCliente | undefined
  private pendientes = new Map<string, PendienteAprobacion>()

  constructor(opciones: OpcionesGestorPermisos = {}) {
    this.directorioProyecto = opciones.directorioProyecto
    this.reglasGlobales = [...(opciones.reglasGlobales ?? [])]
    this.reglasAgente = [...(opciones.reglasAgente ?? [])]
    this.aprobaciones = [
      ...(opciones.aprobacionesIniciales ??
        (opciones.directorioProyecto
          ? cargarAprobacionesGuardadas(opciones.directorioProyecto)
          : [])),
    ]
    this.incluirBase = opciones.incluirBase ?? true
    this.esInteractivo = opciones.esInteractivo ?? true
    this.manejadorAprobacion = opciones.manejadorAprobacion
  }

  establecerReglasAgente(reglas: readonly ReglaPermiso[] = []): void {
    this.reglasAgente = [...reglas]
  }

  establecerReglasGlobales(reglas: readonly ReglaPermiso[]): void {
    this.reglasGlobales = [...reglas]
  }

  establecerInteractivo(esInteractivo: boolean): void {
    this.esInteractivo = esInteractivo
  }

  establecerManejadorAprobacion(
    manejador: ManejadorAprobacionCliente | undefined,
  ): void {
    this.manejadorAprobacion = manejador
  }

  obtenerAprobacionesGuardadas(): ReglaPermiso[] {
    return [...this.aprobaciones]
  }

  private obtenerReglasGlobalesEfectivas(): ReglaPermiso[] {
    const deArchivo = this.directorioProyecto
      ? cargarReglasProyecto(this.directorioProyecto)
      : []
    return [...deArchivo, ...this.reglasGlobales]
  }

  evaluar(
    herramienta: {
      nombre: string
      accionPermiso?: AccionPermiso | undefined
      resolverAccion?:
        | ((args: Record<string, unknown>) => AccionPermiso)
        | undefined
      obtenerRecurso?:
        | ((args: Record<string, unknown>) => string | string[])
        | undefined
      proponerPatron?:
        | ((args: Record<string, unknown>, recurso: string) => string)
        | undefined
    },
    argumentos: Record<string, unknown>,
  ): EvaluacionPermiso {
    const accionRaw =
      herramienta.resolverAccion?.(argumentos) ??
      herramienta.accionPermiso ??
      'read'
    const recursos = herramienta.obtenerRecurso
      ? herramienta.obtenerRecurso(argumentos)
      : '*'

    const resultado = evaluarOperacionPermiso({
      accion: accionRaw,
      recursos,
      reglasGlobales: this.obtenerReglasGlobalesEfectivas(),
      reglasAgente: this.reglasAgente,
      aprobacionesGuardadas: this.aprobaciones,
      incluirBase: this.incluirBase,
      directorioProyecto: this.directorioProyecto,
    })

    const patronSugerido = herramienta.proponerPatron
      ? herramienta.proponerPatron(argumentos, resultado.recurso)
      : proponerPatronPorDefecto(resultado.accion, resultado.recurso)

    return {
      efecto: resultado.efecto,
      accion: resultado.accion,
      recurso: resultado.recurso,
      patronSugerido,
    }
  }

  registrarAprobacionSiempre(
    accion: AccionPermiso,
    patronSugerido: string,
  ): ReglaPermiso {
    const regla: ReglaPermiso = {
      accion: normalizarAccionPermiso(accion),
      recurso: patronSugerido,
      efecto: 'permitir',
    }
    this.aprobaciones.push(regla)
    if (this.directorioProyecto) {
      guardarReglaAprobada(this.directorioProyecto, regla)
    }
    return regla
  }

  rechazarTodasLasPendientes(): void {
    const entradas = Array.from(this.pendientes.values())
    this.pendientes.clear()
    for (const pendiente of entradas) {
      pendiente.resolver('denegar')
    }
  }

  async solicitarAprobacion(
    solicitud: SolicitudAprobacion,
    senalCancelacion?: AbortSignal,
  ): Promise<DecisionAprobacion> {
    if (!this.esInteractivo || !this.manejadorAprobacion) {
      return 'denegar'
    }
    if (senalCancelacion?.aborted) {
      return 'denegar'
    }

    const manejador = this.manejadorAprobacion
    return new Promise<DecisionAprobacion>((resolve) => {
      let resuelta = false
      const finalizar = (decision: DecisionAprobacion): void => {
        if (resuelta) return
        resuelta = true
        this.pendientes.delete(solicitud.id)
        if (senalCancelacion) {
          senalCancelacion.removeEventListener('abort', alAbortar)
        }
        if (decision === 'siempre') {
          this.registrarAprobacionSiempre(
            solicitud.accion,
            solicitud.patronSugerido,
          )
        } else if (decision === 'denegar') {
          this.rechazarTodasLasPendientes()
        }
        resolve(decision)
      }

      const alAbortar = (): void => {
        finalizar('denegar')
      }

      if (senalCancelacion) {
        senalCancelacion.addEventListener('abort', alAbortar, { once: true })
      }

      this.pendientes.set(solicitud.id, {
        id: solicitud.id,
        resolver: finalizar,
      })

      void manejador(solicitud, senalCancelacion).then(
        (decision) => finalizar(decision),
        () => finalizar('denegar'),
      )
    })
  }
}
