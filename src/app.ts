import type { RegistroHerramientas } from './core/registry.js'
import { type FabricaProveedor, SesionInteractiva } from './interface/runner.js'
import type { EstadoSesionVisual } from './interface/state.js'
import {
  type ConfiguracionHarness,
  cargarConfig,
  listarModelos,
} from './provider/config.js'
import { resolverProveedor } from './provider/factory.js'
import type { Proveedor } from './provider/types.js'
import { crearCatalogoPorDefecto } from './tools/catalog.js'

export interface OpcionesHarness {
  directorioProyecto?: string | undefined
  proveedor?: Proveedor | undefined
  registro?: RegistroHerramientas | undefined
  config?: ConfiguracionHarness | undefined
  promptSistema?: string | undefined
  ventanaContexto?: number | undefined
  credencialesSanitizar?: string[] | undefined
  modelosDisponibles?: string[] | undefined
  modeloActivo?: string | undefined
  fabricaProveedor?: FabricaProveedor | undefined
  alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
}

export interface HarnessConstruido {
  sesion: SesionInteractiva
  registro: RegistroHerramientas
  proveedor: Proveedor
  config?: ConfiguracionHarness | undefined
}

const PROMPT_SISTEMA_POR_DEFECTO =
  'Sos un agente de programación que trabaja sobre el proyecto actual. Usá las herramientas para leer, buscar, editar y verificar antes de responder. Si una herramienta devuelve un error, leelo y corregí el rumbo. Respondé en el idioma del usuario.'

/**
 * Ensambla catálogo, provider y sesión en un solo lugar, para poder probar el
 * cableado sin spawnear un proceso.
 */
export function construirHarness(
  opciones: OpcionesHarness = {},
): HarnessConstruido {
  const directorioProyecto = opciones.directorioProyecto ?? process.cwd()
  const registro =
    opciones.registro ?? crearCatalogoPorDefecto({ directorioProyecto })

  let proveedor = opciones.proveedor
  let ventanaContexto = opciones.ventanaContexto ?? 128000
  let credencialesSanitizar = opciones.credencialesSanitizar ?? []
  let modelosDisponibles = opciones.modelosDisponibles ?? []
  let modeloActivo = opciones.modeloActivo ?? ''
  let fabricaProveedor = opciones.fabricaProveedor
  let config = opciones.config

  if (!proveedor) {
    config = config ?? cargarConfig({ directorioProyecto })
    const resuelto = resolverProveedor({ config })
    proveedor = resuelto.proveedor
    ventanaContexto = resuelto.ventanaContexto
    credencialesSanitizar = resuelto.credencialesSanitizar
    modelosDisponibles = listarModelos(config)
    modeloActivo = `${resuelto.proveedorId}/${resuelto.modelo.id}`

    const configResuelta = config
    fabricaProveedor = (proveedorId, modeloId) => {
      const nuevo = resolverProveedor({
        config: configResuelta,
        proveedorId,
        modeloId,
      })
      return {
        proveedor: nuevo.proveedor,
        ventanaContexto: nuevo.ventanaContexto,
        credencialesSanitizar: nuevo.credencialesSanitizar,
      }
    }
  }

  if (!proveedor) {
    throw new Error('No se pudo construir el proveedor de la sesión.')
  }

  if (!modeloActivo && proveedor.modelo) {
    modeloActivo = `${proveedor.nombre}/${proveedor.modelo}`
  }
  if (modelosDisponibles.length === 0 && modeloActivo) {
    modelosDisponibles = [modeloActivo]
  }

  const sesion = new SesionInteractiva({
    proveedor,
    registro,
    promptSistema: opciones.promptSistema ?? PROMPT_SISTEMA_POR_DEFECTO,
    ventanaContexto,
    credencialesSanitizar,
    modelosDisponibles,
    modeloActivo,
    fabricaProveedor,
    alActualizar: opciones.alActualizar,
  })

  return { sesion, registro, proveedor, config }
}
