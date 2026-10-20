import {
  crearProveedorOpenAICompatible,
  type OpcionesProveedorOpenAICompatible,
} from './adapters/openai-compatible.js'
import {
  type ConfiguracionHarness,
  credencialDeProveedor,
  credencialesDeConfig,
  type ModeloConfigurado,
  resolverModeloConfig,
} from './config.js'
import type { OpcionesReintento } from './retry.js'
import { ErrorProveedor, type Proveedor } from './types.js'

export interface OpcionesResolverProveedor {
  config: ConfiguracionHarness
  proveedorId?: string | undefined
  modeloId?: string | undefined
  entorno?: NodeJS.ProcessEnv | undefined
  fetchImpl?: typeof fetch | undefined
  opcionesReintento?: OpcionesReintento | undefined
}

export interface ProveedorResuelto {
  proveedor: Proveedor
  proveedorId: string
  modelo: ModeloConfigurado
  ventanaContexto: number
  credencialesSanitizar: string[]
}

type CreadorAdaptador = (
  opciones: OpcionesProveedorOpenAICompatible,
) => Proveedor

const ADAPTADORES = new Map<string, CreadorAdaptador>([
  ['openai-compatible', crearProveedorOpenAICompatible],
])

const VENTANA_CONTEXTO_POR_DEFECTO = 128000

/**
 * Resuelve proveedor, modelo y credencial, y construye el adaptador sin tocar
 * el bucle. Un tipo desconocido falla con un mensaje que dice qué configurar.
 */
export function resolverProveedor(
  opciones: OpcionesResolverProveedor,
): ProveedorResuelto {
  const resuelto = resolverModeloConfig(
    opciones.config,
    opciones.proveedorId,
    opciones.modeloId,
  )
  const creador = ADAPTADORES.get(resuelto.proveedor.tipo)
  if (!creador) {
    throw new ErrorProveedor(
      `El tipo de proveedor '${resuelto.proveedor.tipo}' no tiene adaptador. Tipos disponibles: ${[...ADAPTADORES.keys()].join(', ')}.`,
    )
  }

  const apiKey = credencialDeProveedor(
    resuelto.proveedor,
    opciones.entorno ?? process.env,
  )

  const proveedor = creador({
    nombre: resuelto.proveedorId,
    modelo: resuelto.modelo.id,
    baseUrl: resuelto.proveedor.baseUrl,
    apiKey,
    cabecerasExtra: resuelto.proveedor.cabecerasExtra,
    soportaHerramientas: resuelto.modelo.soportaHerramientas,
    maxTokensSalida: resuelto.modelo.maxTokensSalida,
    fetchImpl: opciones.fetchImpl,
    opcionesReintento: opciones.opcionesReintento,
  })

  return {
    proveedor,
    proveedorId: resuelto.proveedorId,
    modelo: resuelto.modelo,
    ventanaContexto:
      resuelto.modelo.ventanaContexto ?? VENTANA_CONTEXTO_POR_DEFECTO,
    credencialesSanitizar: credencialesDeConfig(
      opciones.config,
      opciones.entorno ?? process.env,
    ),
  }
}

export function crearProveedor(opciones: OpcionesResolverProveedor): Proveedor {
  return resolverProveedor(opciones).proveedor
}
