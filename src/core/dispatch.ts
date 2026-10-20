import { sanitizarTexto } from '../provider/credentials.js'
import type { RegistroHerramientas } from './registry.js'

export interface ResultadoDespacho {
  resultado: string
  esError: boolean
}

/**
 * Normaliza los argumentos si llegaron serializados como cadena de texto JSON.
 */
function normalizarArgumentos(argsRaw: unknown): Record<string, unknown> {
  if (typeof argsRaw === 'string') {
    try {
      return JSON.parse(argsRaw) as Record<string, unknown>
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

interface EsquemaEstructurado {
  required?: string[] | undefined
  properties?: Record<string, unknown> | undefined
}

/**
 * Valida los argumentos contra el esquema declarado (JSON Schema o mapa de propiedades),
 * descartando campos adicionales no declarados y exigiendo los campos obligatorios.
 */
function validarYFiltrarArgumentos(
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

  // Descartar campos que el esquema no declara
  const filtrados: Record<string, unknown> = {}
  for (const [clave, valor] of Object.entries(argumentos)) {
    if (!propiedades || Object.hasOwn(propiedades, clave)) {
      filtrados[clave] = valor
    }
  }

  return { valido: true, filtrados }
}

/**
 * Despacha la ejecución de una herramienta resolviéndola contra el registro,
 * validando sus argumentos y capturando cualquier error para retornarlo como texto al modelo.
 */
export async function despacharHerramienta(
  nombre: string,
  argsRaw: unknown,
  registro: RegistroHerramientas,
  credenciales: string[] = [],
): Promise<ResultadoDespacho> {
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

  try {
    const salida = await herramienta.ejecutar(validacion.filtrados)
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
