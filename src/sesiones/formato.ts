import { sanitizarTexto } from '../provider/credentials.js'
import type { Mensaje, RolMensaje } from '../types.js'

export class ErrorSesion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorSesion'
  }
}

export type EstadoTurnoGuardado = 'completado' | 'cancelado' | 'fallido'

export type RegistroSesion =
  | { tipo: 'turno'; estado: EstadoTurnoGuardado; mensajes: Mensaje[] }
  | { tipo: 'compactacion'; mensajes: Mensaje[] }

export interface SesionMetadata {
  id: string
  creadaEn: string
  actualizadaEn: string
  directorio: string
  modelo: string
  agente: string
  mensajes: number
  padre?: string | undefined
  desdeTurno?: number | undefined
}

export interface SesionCargada {
  metadata: SesionMetadata
  mensajes: Mensaje[]
}

const ROLES: ReadonlySet<string> = new Set([
  'user',
  'assistant',
  'tool',
  'system',
])

const ESTADOS: ReadonlySet<string> = new Set([
  'completado',
  'cancelado',
  'fallido',
])

const ID_VALIDO = /^[A-Za-z0-9._-]+$/

export function esIdSesionValido(id: string): boolean {
  return (
    id.length > 0 &&
    id !== '.' &&
    id !== '..' &&
    ID_VALIDO.test(id) &&
    !id.includes('..')
  )
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function sanearValor(valor: unknown, credenciales: string[]): unknown {
  if (typeof valor === 'string') {
    return sanitizarTexto(valor, credenciales)
  }
  if (Array.isArray(valor)) {
    return valor.map((item) => sanearValor(item, credenciales))
  }
  if (esObjeto(valor)) {
    const resultado: Record<string, unknown> = {}
    for (const [clave, contenido] of Object.entries(valor)) {
      resultado[clave] = sanearValor(contenido, credenciales)
    }
    return resultado
  }
  return valor
}

/** Clona los mensajes y redacta la credencial en cada cadena antes de persistir. */
export function sanearMensajes(
  mensajes: readonly Mensaje[],
  credenciales: readonly string[] = [],
): Mensaje[] {
  return sanearValor(mensajes, [...credenciales]) as Mensaje[]
}

function validarMensaje(valor: unknown): valor is Mensaje {
  if (!esObjeto(valor)) return false
  if (typeof valor.rol !== 'string' || !ROLES.has(valor.rol)) return false
  if (valor.contenido !== undefined && typeof valor.contenido !== 'string') {
    return false
  }
  if (valor.resultado !== undefined && typeof valor.resultado !== 'string') {
    return false
  }
  if (valor.idLlamada !== undefined && typeof valor.idLlamada !== 'string') {
    return false
  }
  if (
    valor.llamadasHerramientas !== undefined &&
    !Array.isArray(valor.llamadasHerramientas)
  ) {
    return false
  }
  return true
}

function validarMensajes(valor: unknown): Mensaje[] | undefined {
  if (!Array.isArray(valor)) return undefined
  if (!valor.every(validarMensaje)) return undefined
  return valor as Mensaje[]
}

/**
 * Serializa un registro en una sola línea. La credencial ya viene redactada por
 * `sanearMensajes`; acá solo se evita que un salto de línea rompa el archivo.
 */
export function serializarRegistro(registro: RegistroSesion): string {
  return JSON.stringify(registro)
}

/** Devuelve el registro o `undefined` si la línea no es un registro válido. */
export function parsearRegistro(linea: string): RegistroSesion | undefined {
  if (linea.trim() === '') return undefined
  let datos: unknown
  try {
    datos = JSON.parse(linea)
  } catch {
    return undefined
  }
  if (!esObjeto(datos)) return undefined

  if (datos.tipo === 'turno') {
    const estado = typeof datos.estado === 'string' ? datos.estado : ''
    const mensajes = validarMensajes(datos.mensajes)
    if (!ESTADOS.has(estado) || !mensajes) return undefined
    return {
      tipo: 'turno',
      estado: estado as EstadoTurnoGuardado,
      mensajes,
    }
  }

  if (datos.tipo === 'compactacion') {
    const mensajes = validarMensajes(datos.mensajes)
    if (!mensajes) return undefined
    return { tipo: 'compactacion', mensajes }
  }

  return undefined
}

/** Aplica los registros en orden: los turnos agregan y la compactación reemplaza. */
export function reproducirRegistros(
  registros: readonly RegistroSesion[],
): Mensaje[] {
  let mensajes: Mensaje[] = []
  for (const registro of registros) {
    if (registro.tipo === 'turno') {
      mensajes = [...mensajes, ...registro.mensajes]
    } else {
      mensajes = [...registro.mensajes]
    }
  }
  return mensajes
}

export function validarMetadata(
  valor: unknown,
  idEsperado?: string,
): SesionMetadata {
  if (!esObjeto(valor)) {
    throw new ErrorSesion('Los metadatos de la sesión no son un objeto válido.')
  }
  if (typeof valor.id !== 'string' || !esIdSesionValido(valor.id)) {
    throw new ErrorSesion(
      'Los metadatos de la sesión no declaran un id válido.',
    )
  }
  if (idEsperado && valor.id !== idEsperado) {
    throw new ErrorSesion(
      `La sesión '${idEsperado}' declara un id distinto en sus metadatos.`,
    )
  }
  for (const campo of ['creadaEn', 'actualizadaEn', 'directorio'] as const) {
    if (typeof valor[campo] !== 'string' || !valor[campo]) {
      throw new ErrorSesion(
        `Los metadatos de la sesión no declaran '${campo}' válido.`,
      )
    }
  }
  return {
    id: valor.id,
    creadaEn: valor.creadaEn as string,
    actualizadaEn: valor.actualizadaEn as string,
    directorio: valor.directorio as string,
    modelo: typeof valor.modelo === 'string' ? valor.modelo : '',
    agente: typeof valor.agente === 'string' ? valor.agente : 'build',
    mensajes:
      typeof valor.mensajes === 'number' && valor.mensajes >= 0
        ? valor.mensajes
        : 0,
    ...(typeof valor.padre === 'string' ? { padre: valor.padre } : {}),
    ...(typeof valor.desdeTurno === 'number'
      ? { desdeTurno: valor.desdeTurno }
      : {}),
  }
}

export function rolValido(rol: string): rol is RolMensaje {
  return ROLES.has(rol)
}
