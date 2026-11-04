import { evaluarOperacionPermiso } from '../permissions/reglas.js'
import type { ReglaPermiso } from '../types.js'
import type { HerramientaMcp } from './types.js'

export interface OpcionesPermisoMcp {
  reglasGlobales?: readonly ReglaPermiso[]
  reglasAgente?: readonly ReglaPermiso[]
  aprobacionesGuardadas?: readonly ReglaPermiso[]
  directorioProyecto?: string
  tieneTty?: boolean
}

export interface VerificacionPermisoMcp {
  permitido: boolean
  requiereAprobacion: boolean
  motivo?: string
}

export function evaluarPermisoHerramientaMcp(
  herramienta: HerramientaMcp,
  opciones: OpcionesPermisoMcp = {},
): VerificacionPermisoMcp {
  const tieneTty = opciones.tieneTty ?? true

  // Elevación obligatoria por motivo de riesgo
  if (herramienta.riesgoso) {
    if (!tieneTty) {
      return {
        permitido: false,
        requiereAprobacion: false,
        motivo: `Herramienta riesgosa '${herramienta.nombreCompleto}' requiere aprobación pero no hay terminal interactiva: ${herramienta.motivoRiesgo ?? 'riesgo declarado'}`,
      }
    }
    return {
      permitido: false,
      requiereAprobacion: true,
      motivo:
        herramienta.motivoRiesgo ??
        `La herramienta MCP '${herramienta.nombreCompleto}' declara riesgo`,
    }
  }

  // Recurso: <servidor>/<herramienta>
  const recurso = `${herramienta.servidor}/${herramienta.nombre}`
  const resultado = evaluarOperacionPermiso({
    accion: 'mcp',
    recursos: recurso,
    reglasGlobales: opciones.reglasGlobales,
    reglasAgente: opciones.reglasAgente,
    aprobacionesGuardadas: opciones.aprobacionesGuardadas,
    directorioProyecto: opciones.directorioProyecto,
  })

  if (resultado.efecto === 'denegar') {
    return {
      permitido: false,
      requiereAprobacion: false,
      motivo: `Uso de herramienta MCP '${herramienta.nombreCompleto}' denegado por regla de permisos`,
    }
  }

  if (resultado.efecto === 'consultar') {
    if (!tieneTty) {
      return {
        permitido: false,
        requiereAprobacion: false,
        motivo: `Uso de herramienta MCP '${herramienta.nombreCompleto}' requiere aprobación pero no hay terminal interactiva`,
      }
    }
    return {
      permitido: false,
      requiereAprobacion: true,
      motivo: `Consulta requerida para herramienta MCP '${herramienta.nombreCompleto}'`,
    }
  }

  return { permitido: true, requiereAprobacion: false }
}
