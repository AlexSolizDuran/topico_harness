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
import type { GestorTareasBackground } from './background.js'
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
  gestorTareas?: GestorTareasBackground | undefined
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
      background: {
        type: 'boolean',
        description:
          'Si es true, inicia la tarea y devuelve el control sin esperar el resultado.',
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

  const validarSolicitudTarea = (
    args: Record<string, unknown>,
  ): { error: string } | { subagente: DefinicionAgente; pedido: string } => {
    const nombreAgente = typeof args.agent === 'string' ? args.agent.trim() : ''
    const pedido = typeof args.prompt === 'string' ? args.prompt.trim() : ''

    if (!nombreAgente || !pedido) {
      return {
        error:
          "ERROR: Los argumentos 'agent' y 'prompt' son obligatorios y deben ser texto no vacío.\nLa operación no se completó.",
      }
    }

    const todos = opciones.obtenerAgentes()
    const activo = opciones.obtenerAgenteActivo?.()
    const disponibles = obtenerDisponibles()
    const listaNombres =
      disponibles.map((s) => s.nombre).join(', ') || 'ninguno'

    if (activo && nombreAgente === activo) {
      return {
        error: `ERROR: El agente activo '${nombreAgente}' no se puede lanzar como subagente de sí mismo. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`,
      }
    }

    const encontrado = todos.find((a) => a.nombre === nombreAgente)
    if (!encontrado) {
      return {
        error: `ERROR: El subagente '${nombreAgente}' no existe. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`,
      }
    }

    if (!esSubagenteLanzable(encontrado)) {
      return {
        error: `ERROR: El agente '${nombreAgente}' es de modo primario y no se puede lanzar como subagente. Subagentes disponibles: ${listaNombres}.\nLa operación no se completó.`,
      }
    }

    return { subagente: encontrado, pedido }
  }

  const ejecutarSubagente = async (
    subagente: DefinicionAgente,
    pedido: string,
    senal?: AbortSignal,
  ): Promise<string> => {
    const resultado = await ejecutarTurnoSubagente({
      subagente,
      pedido,
      catalogo: opciones.obtenerCatalogo(),
      proveedorPadre: opciones.obtenerProveedorPadre(),
      ventanaContextoPadre: opciones.obtenerVentanaPadre?.(),
      resolverModelo: opciones.resolverModelo,
      promptSistemaBase: opciones.obtenerPromptBase?.(),
      limitePasos: opciones.obtenerLimitePasos?.(),
      maximoContenido: opciones.maximoContenido,
      credencialesSanitizar: opciones.obtenerCredenciales?.(),
      senalCancelacionPadre: senal,
      portero: opciones.crearPorteroSubagente?.(subagente),
    })
    return resultado.salida
  }

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

      const preparado = validarSolicitudTarea(args)
      if ('error' in preparado) return preparado.error
      const { subagente, pedido } = preparado

      if (args.background === true) {
        if (!opciones.gestorTareas) {
          return 'ERROR: Las tareas en background no están disponibles en esta configuración.\nLa operación no se completó.'
        }
        try {
          const tarea = opciones.gestorTareas.iniciar({
            agente: subagente.nombre,
            pedido,
            ejecutar: (senal) => ejecutarSubagente(subagente, pedido, senal),
          })
          return `Tarea en background iniciada: ${tarea.id} (agente: ${subagente.nombre}). Usá task_status para consultarla o task_cancel para cancelarla.`
        } catch (error) {
          return `ERROR: ${(error as Error).message}\nLa operación no se completó.`
        }
      }

      return ejecutarSubagente(subagente, pedido, senalCancelacion)
    },
  }
}
