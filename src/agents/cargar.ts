import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { crearAgentesPorDefecto, listarAgentesPrimarios } from './defaults.js'
import {
  type DefinicionAgente,
  ErrorDefinicionAgente,
  esAgentePrimario,
  type OpcionesValidacionAgentes,
  validarDefinicionAgente,
} from './definiciones.js'

export interface ConfiguracionAgentesCargada {
  agentes: DefinicionAgente[]
  agentePorDefecto: string
}

export interface OpcionesCargarAgentes extends OpcionesValidacionAgentes {
  directorioProyecto?: string | undefined
  rutaArchivo?: string | undefined
  incluirDefaults?: boolean | undefined
}

export function rutaAgentesProyecto(directorioProyecto: string): string {
  return join(directorioProyecto, '.harness', 'agents.json')
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function leerArchivoAgentes(ruta: string): {
  agentesRaw: unknown[]
  agentePorDefecto?: string | undefined
  incluirDefaults?: boolean | undefined
} {
  let texto: string
  try {
    texto = readFileSync(ruta, 'utf-8')
  } catch (error) {
    throw new ErrorDefinicionAgente(
      `No se pudo leer el archivo de agentes en ${ruta}: ${(error as Error).message}`,
    )
  }

  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new ErrorDefinicionAgente(
      `El archivo de agentes no es JSON válido: ${ruta}`,
    )
  }

  if (!esObjeto(datos) || !Array.isArray(datos.agentes)) {
    throw new ErrorDefinicionAgente(
      `El archivo de agentes debe declarar una lista 'agentes': ${ruta}`,
    )
  }

  if (
    datos.agentePorDefecto !== undefined &&
    (typeof datos.agentePorDefecto !== 'string' ||
      datos.agentePorDefecto.trim().length === 0)
  ) {
    throw new ErrorDefinicionAgente(
      `'agentePorDefecto' debe ser un nombre válido en ${ruta}`,
    )
  }

  return {
    agentesRaw: datos.agentes,
    ...(typeof datos.agentePorDefecto === 'string'
      ? { agentePorDefecto: datos.agentePorDefecto.trim() }
      : {}),
    ...(typeof datos.incluirDefaults === 'boolean'
      ? { incluirDefaults: datos.incluirDefaults }
      : {}),
  }
}

function resolverAgentePorDefecto(
  agentes: DefinicionAgente[],
  preferido?: string,
): string {
  const primarios = listarAgentesPrimarios(agentes)
  if (primarios.length === 0) {
    throw new ErrorDefinicionAgente(
      'El conjunto de agentes no tiene ningún agente primario ni de modo ambos; no hay agente activo posible.',
    )
  }

  if (preferido) {
    const encontrado = agentes.find((a) => a.nombre === preferido)
    if (!encontrado) {
      throw new ErrorDefinicionAgente(
        `El agente por defecto '${preferido}' no existe.`,
      )
    }
    if (!esAgentePrimario(encontrado)) {
      throw new ErrorDefinicionAgente(
        `El agente por defecto '${preferido}' no es un agente primario.`,
      )
    }
    return encontrado.nombre
  }

  return primarios[0]?.nombre ?? 'build'
}

/**
 * Carga las definiciones de `.harness/agents.json` si existe, las valida contra
 * el catálogo de herramientas y los modelos configurados, y las combina por
 * nombre con los agentes por defecto.
 */
export function cargarAgentes(
  opciones: OpcionesCargarAgentes,
): ConfiguracionAgentesCargada {
  const dir = opciones.directorioProyecto ?? process.cwd()
  const ruta = opciones.rutaArchivo ?? rutaAgentesProyecto(dir)
  const defaults = crearAgentesPorDefecto(opciones.herramientasDisponibles)

  if (!existsSync(ruta)) {
    const agentePorDefecto = resolverAgentePorDefecto(defaults)
    return { agentes: defaults, agentePorDefecto }
  }

  const leido = leerArchivoAgentes(ruta)
  const vistosEnArchivo = new Set<string>()
  const desdeArchivo: DefinicionAgente[] = []

  for (const raw of leido.agentesRaw) {
    const validado = validarDefinicionAgente(raw, opciones)
    if (vistosEnArchivo.has(validado.nombre)) {
      throw new ErrorDefinicionAgente(
        `Nombre de agente repetido en ${ruta}: '${validado.nombre}'.`,
      )
    }
    vistosEnArchivo.add(validado.nombre)
    desdeArchivo.push(validado)
  }

  const usarDefaults =
    opciones.incluirDefaults ??
    leido.incluirDefaults ??
    (desdeArchivo.length === 0 || desdeArchivo.some(esAgentePrimario))

  const mapa = new Map<string, DefinicionAgente>()
  if (usarDefaults) {
    for (const base of defaults) {
      mapa.set(base.nombre, base)
    }
  }
  for (const personalizado of desdeArchivo) {
    mapa.set(personalizado.nombre, personalizado)
  }

  const agentes = Array.from(mapa.values())
  const agentePorDefecto = resolverAgentePorDefecto(
    agentes,
    leido.agentePorDefecto,
  )

  return { agentes, agentePorDefecto }
}
