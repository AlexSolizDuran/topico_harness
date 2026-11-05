import type { EntradaHerramienta } from '../core/registry.js'
import type { GestorMcp } from './gestor.js'
import type { HerramientaMcp } from './types.js'

export const ESQUEMA_MCP_PERMISIVO: Record<string, unknown> = {
  type: 'object',
  properties: {},
  additionalProperties: true,
}

function esquemaVisible(herramienta: HerramientaMcp): Record<string, unknown> {
  const esquema = herramienta.esquemaJson
  return typeof esquema === 'object' &&
    esquema !== null &&
    !Array.isArray(esquema)
    ? esquema
    : ESQUEMA_MCP_PERMISIVO
}

/**
 * Convierte una herramienta de un servidor MCP en una entrada del catálogo.
 * El nombre visible lleva el prefijo del servidor y el recurso de permiso es
 * `<servidor>/<herramienta>`. Si el servidor declara riesgo, la aprobación
 * obligatoria se eleva con ese motivo.
 */
export function crearEntradaHerramientaMcp(
  gestor: GestorMcp,
  herramienta: HerramientaMcp,
): EntradaHerramienta {
  const motivoRiesgo = herramienta.riesgoso
    ? (herramienta.motivoRiesgo ??
      `La herramienta MCP '${herramienta.nombreCompleto}' declara riesgo.`)
    : undefined

  return {
    nombre: herramienta.nombreCompleto,
    descripcion: herramienta.descripcion,
    esquema: esquemaVisible(herramienta),
    accionPermiso: 'mcp',
    obtenerRecurso: () => `${herramienta.servidor}/${herramienta.nombre}`,
    ...(motivoRiesgo
      ? { motivoAprobacionObligatoria: () => motivoRiesgo }
      : {}),
    admiteParalelo: true,
    ejecutar: (argumentos) =>
      gestor.ejecutarHerramienta(herramienta.nombreCompleto, argumentos),
  }
}
