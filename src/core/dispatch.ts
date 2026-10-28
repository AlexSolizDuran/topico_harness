import { sanitizarTexto } from '../provider/credentials.js'
import type { PorteroPermisos } from '../types.js'
import type { EntradaHerramienta, RegistroHerramientas } from './registry.js'

export interface ResultadoDespacho {
  resultado: string
  esError: boolean
}

export interface OpcionesDespacho {
  credenciales?: string[] | undefined
  senalCancelacion?: AbortSignal | undefined
  portero?: PorteroPermisos | undefined
  idLlamada?: string | undefined
  omitirGatePermiso?: boolean | undefined
}

/**
 * Normaliza los argumentos si llegaron serializados como cadena de texto JSON.
 */
export function normalizarArgumentos(
  argsRaw: unknown,
): Record<string, unknown> {
  if (typeof argsRaw === 'string') {
    try {
      const parsed = JSON.parse(argsRaw) as unknown
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        return { ...(parsed as Record<string, unknown>) }
      }
      return {}
    } catch {
      return {}
    }
  }

  if (
    typeof argsRaw === 'object' &&
    argsRaw !== null &&
    !Array.isArray(argsRaw)
  ) {
    return { ...(argsRaw as Record<string, unknown>) }
  }

  return {}
}

interface PropiedadEsquema {
  type?: string | undefined
}

interface EsquemaEstructurado {
  required?: string[] | undefined
  properties?: Record<string, PropiedadEsquema> | undefined
}

function tipoCoincide(valor: unknown, tipoEsperado: string): boolean {
  if (tipoEsperado === 'string') return typeof valor === 'string'
  if (tipoEsperado === 'number') return typeof valor === 'number'
  if (tipoEsperado === 'boolean') return typeof valor === 'boolean'
  if (tipoEsperado === 'array') return Array.isArray(valor)
  if (tipoEsperado === 'object') {
    return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
  }
  return true
}

/**
 * Valida los argumentos contra el esquema declarado (JSON Schema o mapa de propiedades),
 * descartando campos adicionales no declarados y exigiendo los campos obligatorios.
 */
export function validarYFiltrarArgumentos(
  argumentos: Record<string, unknown>,
  esquemaRaw: Record<string, unknown>,
): {
  valido: boolean
  filtrados: Record<string, unknown>
  error?: string | undefined
} {
  const esquema = esquemaRaw as EsquemaEstructurado
  const requeridos = Array.isArray(esquema.required) ? esquema.required : []

  for (const campo of requeridos) {
    if (argumentos[campo] === undefined || argumentos[campo] === null) {
      return {
        valido: false,
        filtrados: {},
        error: `Error de validación: falta el argumento obligatorio '${campo}'`,
      }
    }
  }

  const propiedades =
    typeof esquema.properties === 'object' && esquema.properties !== null
      ? esquema.properties
      : undefined

  const filtrados: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(argumentos)) {
    if (!propiedades || Object.hasOwn(propiedades, clave)) {
      const defProp = propiedades?.[clave]
      if (defProp?.type && !tipoCoincide(valor, defProp.type)) {
        return {
          valido: false,
          filtrados: {},
          error: `Error de validación: el argumento '${clave}' debe ser de tipo '${defProp.type}'`,
        }
      }
      filtrados[clave] = valor
    }
  }

  return { valido: true, filtrados }
}

function resolverOpcionesDespacho(
  credencialesOOpciones?: string[] | OpcionesDespacho,
): OpcionesDespacho {
  if (!credencialesOOpciones) return {}
  if (Array.isArray(credencialesOOpciones)) {
    return { credenciales: credencialesOOpciones }
  }
  return credencialesOOpciones
}

async function verificarPermisoDespacho(
  herramienta: EntradaHerramienta,
  argumentos: Record<string, unknown>,
  opciones: OpcionesDespacho,
): Promise<ResultadoDespacho | undefined> {
  if (!opciones.portero || opciones.omitirGatePermiso) return undefined

  const evaluacion = opciones.portero.evaluar(herramienta, argumentos)
  if (evaluacion.efecto === 'permitir') return undefined

  if (evaluacion.efecto === 'denegar') {
    return {
      resultado: `ERROR: Permiso denegado para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}'.\nLa operación no se completó.`,
      esError: true,
    }
  }

  if (!opciones.portero.solicitarAprobacion) {
    return {
      resultado: `ERROR: Se requiere aprobación interactiva para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}', pero no hay cliente interactivo.${evaluacion.motivo ? ` Motivo: ${evaluacion.motivo}.` : ''}\nLa operación no se completó.`,
      esError: true,
    }
  }

  const decision = await opciones.portero.solicitarAprobacion(
    {
      id: opciones.idLlamada ?? 'despacho',
      herramienta: herramienta.nombre,
      accion: evaluacion.accion,
      recurso: evaluacion.recurso,
      patronSugerido: evaluacion.patronSugerido,
      obligatoria: evaluacion.obligatoria,
      motivo: evaluacion.motivo,
    },
    opciones.senalCancelacion,
  )

  if (decision === 'denegar') {
    const motivo = evaluacion.motivo ? ` Motivo: ${evaluacion.motivo}.` : ''
    return {
      resultado: `ERROR: Aprobación denegada para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}'.${motivo}\nLa operación no se completó.`,
      esError: true,
    }
  }

  return undefined
}

function ejecutarConCancelacion(
  herramienta: EntradaHerramienta,
  argumentos: Record<string, unknown>,
  senal?: AbortSignal,
): Promise<string> {
  if (!senal) {
    return herramienta.ejecutar(argumentos)
  }
  if (senal.aborted) {
    return Promise.reject(new Error('Operación cancelada por el usuario.'))
  }
  return new Promise<string>((resolve, reject) => {
    const alAbortar = (): void => {
      reject(new Error('Operación cancelada por el usuario.'))
    }
    senal.addEventListener('abort', alAbortar, { once: true })
    herramienta.ejecutar(argumentos, senal).then(
      (res) => {
        senal.removeEventListener('abort', alAbortar)
        resolve(res)
      },
      (err) => {
        senal.removeEventListener('abort', alAbortar)
        reject(err)
      },
    )
  })
}

/**
 * Despacha la ejecución de una herramienta resolviéndola contra el registro,
 * validando sus argumentos y capturando cualquier error para retornarlo como texto al modelo.
 */
export async function despacharHerramienta(
  nombre: string,
  argsRaw: unknown,
  registro: RegistroHerramientas,
  credencialesOOpciones: string[] | OpcionesDespacho = [],
): Promise<ResultadoDespacho> {
  const opciones = resolverOpcionesDespacho(credencialesOOpciones)
  const credenciales = opciones.credenciales ?? []

  if (opciones.senalCancelacion?.aborted) {
    return {
      resultado:
        'ERROR: Operación cancelada porque se canceló el turno.\nLa operación no se completó.',
      esError: true,
    }
  }

  const herramienta = registro.obtener(nombre)
  if (!herramienta) {
    return {
      resultado: `ERROR: Herramienta '${nombre}' no encontrada en el registro.\nLa operación no se completó.`,
      esError: true,
    }
  }

  const argsNormalizados = normalizarArgumentos(argsRaw)
  const validacion = validarYFiltrarArgumentos(
    argsNormalizados,
    herramienta.esquema,
  )

  if (!validacion.valido) {
    return {
      resultado: `ERROR: ${validacion.error}\nLa operación no se completó.`,
      esError: true,
    }
  }

  const rechazoPermiso = await verificarPermisoDespacho(
    herramienta,
    validacion.filtrados,
    opciones,
  )
  if (rechazoPermiso) {
    return rechazoPermiso
  }

  try {
    const salida = await ejecutarConCancelacion(
      herramienta,
      validacion.filtrados,
      opciones.senalCancelacion,
    )
    return {
      resultado: salida,
      esError: false,
    }
  } catch (error) {
    const mensajeOriginal =
      error instanceof Error ? error.message : String(error)
    const mensajeLimpio = sanitizarTexto(mensajeOriginal, credenciales)
    const truncado =
      mensajeLimpio.length > 5000
        ? `${mensajeLimpio.slice(0, 5000)}... [Truncado]`
        : mensajeLimpio

    return {
      resultado: `ERROR: ${truncado}\nLa operación no se completó.`,
      esError: true,
    }
  }
}
