import {
  type DefinicionAgente,
  esAgentePrimario,
  esSubagenteLanzable,
  HERRAMIENTAS_SOLO_LECTURA,
} from './definiciones.js'

export const PROMPT_AGENTE_PLAN =
  'Modo de solo lectura: analizá el proyecto y respondé o proponé un plan sin modificar archivos ni ejecutar comandos.'

export const PROMPT_SUBAGENTE_EXPLORE =
  'Investigá el pedido usando las herramientas de lectura y devolvé solo el resultado final, sin narrar el proceso ni los pasos intermedios.'

/**
 * Crea los agentes por defecto a partir de las herramientas disponibles en la
 * plataforma activa: `build` (completo), `plan` (primario de solo lectura) y
 * `explore` (subagente de solo lectura).
 */
export function crearAgentesPorDefecto(
  herramientasDisponibles: Iterable<string>,
): DefinicionAgente[] {
  const disponibles = Array.from(herramientasDisponibles)
  const soloLectura = disponibles.filter((nombre) =>
    HERRAMIENTAS_SOLO_LECTURA.has(nombre),
  )

  return [
    {
      nombre: 'build',
      descripcion:
        'Agente principal con acceso a todas las herramientas disponibles.',
      modo: 'primario',
      herramientas: disponibles,
    },
    {
      nombre: 'plan',
      descripcion:
        'Agente de solo lectura que puede leer y buscar sin modificar el proyecto ni ejecutar comandos.',
      modo: 'primario',
      herramientas: soloLectura,
      prompt: PROMPT_AGENTE_PLAN,
    },
    {
      nombre: 'explore',
      descripcion:
        'Subagente de solo lectura para investigar archivos y búsquedas acotadas.',
      modo: 'subagente',
      herramientas: soloLectura,
      prompt: PROMPT_SUBAGENTE_EXPLORE,
    },
  ]
}

/**
 * Obtiene las herramientas efectivas para un agente. Cuando corre como
 * subagente, intersecta con las de solo lectura y excluye la delegación.
 */
export function herramientasEfectivasDeAgente(
  agente: DefinicionAgente,
  comoSubagente = false,
): string[] {
  if (!comoSubagente) {
    return [...agente.herramientas]
  }
  return agente.herramientas.filter((nombre) =>
    HERRAMIENTAS_SOLO_LECTURA.has(nombre),
  )
}

export function listarAgentesPrimarios(
  agentes: readonly DefinicionAgente[],
): DefinicionAgente[] {
  return agentes.filter(esAgentePrimario)
}

export function listarSubagentesDisponibles(
  agentes: readonly DefinicionAgente[],
  agenteActivo?: string,
): DefinicionAgente[] {
  return agentes.filter(
    (agente) => esSubagenteLanzable(agente) && agente.nombre !== agenteActivo,
  )
}

export function siguienteAgentePrimario(
  agentes: readonly DefinicionAgente[],
  nombreActual: string,
): string {
  const primarios = listarAgentesPrimarios(agentes)
  if (primarios.length === 0) return nombreActual
  const indice = primarios.findIndex((a) => a.nombre === nombreActual)
  if (indice === -1) {
    return primarios[0]?.nombre ?? nombreActual
  }
  const siguiente = primarios[(indice + 1) % primarios.length]
  return siguiente ? siguiente.nombre : nombreActual
}
