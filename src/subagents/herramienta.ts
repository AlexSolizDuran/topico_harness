import { listarSubagentesDisponibles } from '../agents/defaults.js'
import {
  type DefinicionAgente,
  esSubagenteLanzable,
} from '../agents/definiciones.js'
import type {
  EntradaHerramienta,
  RegistroHerramientas,
} from '../core/registry.js'
import type { Proveedor } from '../provider/types.js'
import type { PorteroPermisos } from '../types.js'
import {
  ejecutarTurnoSubagente,
  type ProveedorResueltoSubagente,
} from './ejecutor.js'

export interface OpcionesHerramientaDelegacion {
  obtenerAgentes: () => readonly DefinicionAgente[]
  obtenerAgenteActivo?: (() => string) | undefined
  obtenerCatalogo: () => RegistroHerramientas
  obtenerProveedorPadre: () => Proveedor
  obtenerVentanaPadre?: (() => number) | undefined
  resolverModelo?: ((modelo: string) => ProveedorResueltoSubagente) | undefined
  obtenerPromptBase?: (() => string | undefined) | undefined
  obtenerLimitePasos?: (() => number | undefined) | undefined
  maximoContenido?: number | undefined
  obtenerCredenciales?: (() => string[]) | undefined
  crearPorteroSubagente?:
    | ((subagente: DefinicionAgente) => PorteroPermisos | undefined)
    | undefined
  enTurnoHijo?: boolean | undefined
}

export function describirHerramientaDelegacion(
  agentes: readonly DefinicionAgente[],
  agenteActivo?: string,
): string {
  const disponibles = listarSubagentesDisponibles(agentes, agenteActivo)
  if (disponibles.length === 0) {
    return 'Delega una investigación acotada a un subagente de solo lectura con contexto aislado.'
  }
  const listado = disponibles
    .map((s) => `${s.nombre}: ${s.descripcion}`)
    .join(' | ')
  return `Delega una investigación acotada a un subagente de solo lectura con contexto aislado. Subagentes disponibles: ${listado}`
}

export function construirEsquemaDelegacion(
  agentes: readonly DefinicionAgente[],
  agenteActivo?: string,
): Record<string, unknown> {
  const disponibles = listarSubagentesDisponibles(agentes, agenteActivo)
  return {
    type: 'object',
    properties: {
      agent: {
        type: 'string',
        enum: disponibles.map((s) => s.nombre),
        description: 'Nombre del subagente disponible a invocar.',
      },
      prompt: {
        type: 'string',
        description: 'Pedido autosuficiente a investigar por el subagente.',
      },
    },
    required: ['agent', 'prompt'],
  }
}

export function crearHerramientaDelegacion(
  opciones: OpcionesHerramientaDelegacion,
): EntradaHerramienta {
  const obtenerDisponibles = (): DefinicionAgente[] =>
    listarSubagentesDisponibles(
      opciones.obtenerAgentes(),
      opciones.obtenerAgenteActivo?.(),
    )

  return {
    nombre: 'task',
    get descripcion(): string {
      return describirHerramientaDelegacion(
        opciones.obtenerAgentes(),
        opciones.obtenerAgenteActivo?.(),
      )
    },
    get esquema(): Record<string, unknown> {
      return construirEsquemaDelegacion(
        opciones.obtenerAgentes(),
        opciones.obtenerAgenteActivo?.(),
      )
    },
    accionPermiso: 'subagent',
    obtenerRecurso: (args) => String(args.agent ?? ''),
    admiteParalelo: false,
    ejecutar: async (args, senalCancelacion) => {
      if (opciones.enTurnoHijo) {
        return 'ERROR: Un subagente no puede lanzar otro subagente (profundidad máxima 1).\nLa operación no se completó.'
      }

      const nombreAgente =
        typeof args.agent === 'string' ? args.agent.trim() : ''
      const pedido = typeof args.prompt === 'string' ? args.prompt.trim() : ''

      if (!nombreAgente || !pedido) {
        return "ERROR: Los argumentos 'agent' y 'prompt' son obligatorios y deben ser texto no vacío.\nLa operación no se completó."
      }

      const todos = opciones.obtenerAgentes()
      const activo = opciones.obtenerAgenteActivo?.()
      const disponibles = obtenerDisponibles()
      const listaNombres =
        disponibles.map((s) => s.nombre).join(', ') || 'ninguno'

      if (activo && nombreAgente === activo) {
        return `ERROR: El agente activo '${nombreAgente}' no se puede lanzar como subagente de sí mismo. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`
      }

      const encontrado = todos.find((a) => a.nombre === nombreAgente)
      if (!encontrado) {
        return `ERROR: El subagente '${nombreAgente}' no existe. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`
      }

      if (!esSubagenteLanzable(encontrado)) {
        return `ERROR: El agente '${nombreAgente}' es de modo primario y no se puede lanzar como subagente. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`
      }

      const resultado = await ejecutarTurnoSubagente({
        subagente: encontrado,
        pedido,
        catalogo: opciones.obtenerCatalogo(),
        proveedorPadre: opciones.obtenerProveedorPadre(),
        ventanaContextoPadre: opciones.obtenerVentanaPadre?.(),
        resolverModelo: opciones.resolverModelo,
        promptSistemaBase: opciones.obtenerPromptBase?.(),
        limitePasos: opciones.obtenerLimitePasos?.(),
        maximoContenido: opciones.maximoContenido,
        credencialesSanitizar: opciones.obtenerCredenciales?.(),
        senalCancelacionPadre: senalCancelacion,
        portero: opciones.crearPorteroSubagente?.(encontrado),
      })

      return resultado.salida
    },
  }
}
