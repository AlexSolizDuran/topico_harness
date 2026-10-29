import type { AccionPermiso, EfectoPermiso, ReglaPermiso } from '../types.js'

export type ModoAgente = 'primario' | 'subagente' | 'ambos'

export const HERRAMIENTAS_SOLO_LECTURA: ReadonlySet<string> = new Set([
  'read',
  'glob',
  'grep',
  'skill',
])

export interface DefinicionAgente {
  nombre: string
  descripcion: string
  modo: ModoAgente
  herramientas: string[]
  prompt?: string | undefined
  modelo?: string | undefined
  permisos?: ReglaPermiso[] | undefined
}

export class ErrorDefinicionAgente extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorDefinicionAgente'
  }
}

export interface OpcionesValidacionAgentes {
  herramientasDisponibles: Iterable<string>
  modelosDisponibles?: Iterable<string> | undefined
}

const MODOS_VALIDOS = new Set<ModoAgente>(['primario', 'subagente', 'ambos'])
const EFECTOS_VALIDOS = new Set<EfectoPermiso>([
  'permitir',
  'consultar',
  'denegar',
])

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

export function esModoAgente(valor: unknown): valor is ModoAgente {
  return typeof valor === 'string' && MODOS_VALIDOS.has(valor as ModoAgente)
}

export function esAgentePrimario(agente: DefinicionAgente): boolean {
  return agente.modo === 'primario' || agente.modo === 'ambos'
}

export function esSubagenteLanzable(agente: DefinicionAgente): boolean {
  return agente.modo === 'subagente' || agente.modo === 'ambos'
}

function validarHerramientasAgente(
  nombre: string,
  modo: ModoAgente,
  herramientasRaw: unknown,
  catalogo: Set<string>,
): string[] {
  if (!Array.isArray(herramientasRaw)) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' debe declarar una lista de herramientas.`,
    )
  }

  const herramientas: string[] = []
  for (const item of herramientasRaw) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      throw new ErrorDefinicionAgente(
        `El agente '${nombre}' declara un nombre de herramienta inválido.`,
      )
    }
    if (!catalogo.has(item)) {
      throw new ErrorDefinicionAgente(
        `El agente '${nombre}' declara una herramienta inexistente en el catálogo: '${item}'.`,
      )
    }
    if (modo === 'subagente' && !HERRAMIENTAS_SOLO_LECTURA.has(item)) {
      throw new ErrorDefinicionAgente(
        `El subagente '${nombre}' no puede declarar la herramienta de efecto '${item}'.`,
      )
    }
    herramientas.push(item)
  }
  return herramientas
}

function validarModeloAgente(
  nombre: string,
  modeloRaw: unknown,
  modelosDisponibles?: Set<string>,
): string | undefined {
  if (modeloRaw === undefined) return undefined
  if (typeof modeloRaw !== 'string' || modeloRaw.trim().length === 0) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' declara un modelo inválido.`,
    )
  }
  const modelo = modeloRaw.trim()
  if (
    modelosDisponibles &&
    modelosDisponibles.size > 0 &&
    !modelosDisponibles.has(modelo)
  ) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' declara un modelo que no está en la configuración: '${modelo}'.`,
    )
  }
  return modelo
}

function validarPermisosAgente(
  nombre: string,
  permisosRaw: unknown,
): ReglaPermiso[] | undefined {
  if (permisosRaw === undefined) return undefined
  if (!Array.isArray(permisosRaw)) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' declara permisos inválidos.`,
    )
  }
  return permisosRaw.map((regla, indice) => {
    if (
      !esObjeto(regla) ||
      typeof regla.accion !== 'string' ||
      typeof regla.recurso !== 'string' ||
      typeof regla.efecto !== 'string' ||
      !EFECTOS_VALIDOS.has(regla.efecto as EfectoPermiso)
    ) {
      throw new ErrorDefinicionAgente(
        `El agente '${nombre}' tiene una regla de permiso inválida en la posición ${indice + 1}.`,
      )
    }
    return {
      accion: regla.accion as AccionPermiso,
      recurso: regla.recurso,
      efecto: regla.efecto as EfectoPermiso,
    }
  })
}

export function validarDefinicionAgente(
  datos: unknown,
  opciones: OpcionesValidacionAgentes,
): DefinicionAgente {
  if (!esObjeto(datos)) {
    throw new ErrorDefinicionAgente(
      'Cada definición de agente debe ser un objeto.',
    )
  }

  const nombre = typeof datos.nombre === 'string' ? datos.nombre.trim() : ''
  if (!nombre) {
    throw new ErrorDefinicionAgente(
      'La definición de agente debe declarar un nombre no vacío.',
    )
  }

  const descripcion =
    typeof datos.descripcion === 'string' ? datos.descripcion.trim() : ''
  if (!descripcion) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' debe declarar una descripción no vacía.`,
    )
  }

  if (!esModoAgente(datos.modo)) {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' declara un modo desconocido: '${String(datos.modo)}'.`,
    )
  }

  if (datos.prompt !== undefined && typeof datos.prompt !== 'string') {
    throw new ErrorDefinicionAgente(
      `El agente '${nombre}' declara un prompt inválido.`,
    )
  }

  const catalogo = new Set(opciones.herramientasDisponibles)
  const modelos = opciones.modelosDisponibles
    ? new Set(opciones.modelosDisponibles)
    : undefined

  const herramientas = validarHerramientasAgente(
    nombre,
    datos.modo,
    datos.herramientas,
    catalogo,
  )
  const modelo = validarModeloAgente(nombre, datos.modelo, modelos)
  const permisos = validarPermisosAgente(nombre, datos.permisos)

  return {
    nombre,
    descripcion,
    modo: datos.modo,
    herramientas,
    ...(datos.prompt !== undefined ? { prompt: datos.prompt } : {}),
    ...(modelo !== undefined ? { modelo } : {}),
    ...(permisos !== undefined ? { permisos } : {}),
  }
}

export function validarConjuntoAgentes(
  definiciones: unknown[],
  opciones: OpcionesValidacionAgentes,
): DefinicionAgente[] {
  const nombresVistos = new Set<string>()
  const validados: DefinicionAgente[] = []

  for (const item of definiciones) {
    const def = validarDefinicionAgente(item, opciones)
    if (nombresVistos.has(def.nombre)) {
      throw new ErrorDefinicionAgente(
        `Nombre de agente repetido: '${def.nombre}'.`,
      )
    }
    nombresVistos.add(def.nombre)
    validados.push(def)
  }

  if (!validados.some(esAgentePrimario)) {
    throw new ErrorDefinicionAgente(
      'El conjunto de agentes no tiene ningún agente primario ni de modo ambos; no hay agente activo posible.',
    )
  }

  return validados
}
