import {
  type DefinicionAgente,
  esSubagenteLanzable,
  HERRAMIENTAS_SOLO_LECTURA,
} from '../agents/definiciones.js'
import { PresupuestoContexto } from '../context/budget.js'
import { calcularTokensHistorial } from '../context/tokens.js'
import { recortarSalidasHerramientasViejas } from '../context/trimming.js'
import type { RegistroHerramientas } from '../core/registry.js'
import { ejecutarTurno, type PreparacionHistorial } from '../core/turn.js'
import type { Proveedor } from '../provider/types.js'
import { truncarContenido } from '../tools/truncate.js'
import type { Mensaje, PorteroPermisos } from '../types.js'

export interface ProveedorResueltoSubagente {
  proveedor: Proveedor
  ventanaContexto?: number | undefined
  credencialesSanitizar?: string[] | undefined
}

export interface OpcionesEjecucionSubagente {
  subagente: DefinicionAgente
  pedido: string
  catalogo: RegistroHerramientas
  proveedorPadre: Proveedor
  ventanaContextoPadre?: number | undefined
  resolverModelo?: ((modelo: string) => ProveedorResueltoSubagente) | undefined
  promptSistemaBase?: string | undefined
  limitePasos?: number | undefined
  maximoContenido?: number | undefined
  credencialesSanitizar?: string[] | undefined
  senalCancelacionPadre?: AbortSignal | undefined
  senalCancelacionHijo?: AbortSignal | undefined
  enTurnoHijo?: boolean | undefined
  portero?: PorteroPermisos | undefined
}

export interface ResultadoSubagente {
  salida: string
  esError: boolean
  canceladoPorPadre: boolean
}

function componerPromptSubagente(
  base: string | undefined,
  propio: string | undefined,
): string | undefined {
  if (base && propio) return `${base}\n\n${propio}`
  return propio || base || undefined
}

function crearPreparadorHistorialHijo(
  presupuesto: PresupuestoContexto,
): (mensajes: Mensaje[]) => PreparacionHistorial {
  return (mensajes: Mensaje[]): PreparacionHistorial => {
    const medicion = calcularTokensHistorial(mensajes)
    if (!presupuesto.estaCercaDelLimite(medicion.tokens)) {
      return { mensajes }
    }
    const recortados = recortarSalidasHerramientasViejas(mensajes)
    const trasRecorte = calcularTokensHistorial(recortados)
    if (trasRecorte.tokens <= presupuesto.limitePresupuesto) {
      return { mensajes: recortados }
    }
    return {
      mensajes: recortados,
      error: `El subagente superó su presupuesto de contexto (${trasRecorte.tokens} > ${presupuesto.limitePresupuesto}).`,
    }
  }
}

function enlazarCancelacionUnidireccional(
  senalPadre?: AbortSignal,
  senalHijo?: AbortSignal,
): { controller: AbortController; limpiar: () => void } {
  const controller = new AbortController()
  const abortar = (): void => {
    controller.abort()
  }

  if (senalPadre?.aborted || senalHijo?.aborted) {
    controller.abort()
    return { controller, limpiar: () => {} }
  }

  senalPadre?.addEventListener('abort', abortar, { once: true })
  senalHijo?.addEventListener('abort', abortar, { once: true })

  return {
    controller,
    limpiar: () => {
      senalPadre?.removeEventListener('abort', abortar)
      senalHijo?.removeEventListener('abort', abortar)
    },
  }
}

/**
 * Ejecuta un turno hijo con contexto aislado, profundidad 1 (sin `task`),
 * herramientas restringidas a lectura y presupuesto/pasos/modelo propios.
 */
export async function ejecutarTurnoSubagente(
  opciones: OpcionesEjecucionSubagente,
): Promise<ResultadoSubagente> {
  if (opciones.enTurnoHijo) {
    return {
      salida:
        'ERROR: Un subagente no puede lanzar otro subagente (profundidad máxima 1).\nLa operación no se completó.',
      esError: true,
      canceladoPorPadre: false,
    }
  }

  const { subagente } = opciones
  if (!esSubagenteLanzable(subagente)) {
    return {
      salida: `ERROR: El agente '${subagente.nombre}' es de modo primario y no se puede lanzar como subagente.\nLa operación no se completó.`,
      esError: true,
      canceladoPorPadre: false,
    }
  }

  let proveedor = opciones.proveedorPadre
  let ventanaContexto = opciones.ventanaContextoPadre ?? 128000
  let credenciales = opciones.credencialesSanitizar ?? []

  if (subagente.modelo && opciones.resolverModelo) {
    try {
      const resuelto = opciones.resolverModelo(subagente.modelo)
      proveedor = resuelto.proveedor
      if (resuelto.ventanaContexto !== undefined) {
        ventanaContexto = resuelto.ventanaContexto
      }
      if (resuelto.credencialesSanitizar) {
        credenciales = resuelto.credencialesSanitizar
      }
    } catch (error) {
      return {
        salida: `ERROR: No se pudo resolver el modelo '${subagente.modelo}' del subagente '${subagente.nombre}': ${(error as Error).message}\nLa operación no se completó.`,
        esError: true,
        canceladoPorPadre: false,
      }
    }
  }

  const presupuesto = new PresupuestoContexto({ ventanaContexto })
  const mensajesIniciales: Mensaje[] = [
    { rol: 'user', contenido: opciones.pedido },
  ]
  const tokensIniciales = calcularTokensHistorial(mensajesIniciales).tokens
  try {
    presupuesto.validarEnvio(tokensIniciales)
  } catch (error) {
    return {
      salida: `ERROR: El subagente '${subagente.nombre}' agotó su presupuesto de contexto: ${(error as Error).message}\nLa operación no se completó.`,
      esError: true,
      canceladoPorPadre: false,
    }
  }

  const nombresPermitidos = subagente.herramientas.filter(
    (nombre) =>
      (HERRAMIENTAS_SOLO_LECTURA.has(nombre) || nombre === 'skill') &&
      nombre !== 'task',
  )
  const registroHijo = opciones.catalogo.filtrar(nombresPermitidos)

  const { controller, limpiar } = enlazarCancelacionUnidireccional(
    opciones.senalCancelacionPadre,
    opciones.senalCancelacionHijo,
  )

  try {
    const generador = ejecutarTurno({
      proveedor,
      registro: registroHijo,
      mensajes: mensajesIniciales,
      sistema: componerPromptSubagente(
        opciones.promptSistemaBase,
        subagente.prompt,
      ),
      limitePasos: opciones.limitePasos,
      senalCancelacion: controller.signal,
      credencialesSanitizar: credenciales,
      prepararHistorial: crearPreparadorHistorialHijo(presupuesto),
      portero: opciones.portero,
      enTurnoHijo: true,
    })

    let textoAcumulado = ''
    let alcanzoLimitePasos = false
    let iter = await generador.next()
    while (!iter.done) {
      const evento = iter.value
      if (evento.tipo === 'texto') {
        textoAcumulado += evento.delta
      } else if (evento.tipo === 'limite_pasos_alcanzado') {
        alcanzoLimitePasos = true
      }
      iter = await generador.next()
    }

    const estadoFinal = iter.value

    if (opciones.senalCancelacionPadre?.aborted) {
      return {
        salida: '',
        esError: true,
        canceladoPorPadre: true,
      }
    }

    if (estadoFinal.tipo === 'cancelado') {
      return {
        salida: `ERROR: El turno del subagente '${subagente.nombre}' fue cancelado.\nLa operación no se completó.`,
        esError: true,
        canceladoPorPadre: false,
      }
    }

    if (estadoFinal.tipo === 'fallido') {
      return {
        salida: `ERROR: El subagente '${subagente.nombre}' no pudo completar el turno: ${estadoFinal.motivo}\nLa operación no se completó.`,
        esError: true,
        canceladoPorPadre: false,
      }
    }

    const mensajesAsistente = estadoFinal.mensajes.filter(
      (m) => m.rol === 'assistant' && m.contenido,
    )
    const ultimoAsistente =
      mensajesAsistente[mensajesAsistente.length - 1]?.contenido ??
      textoAcumulado

    if (alcanzoLimitePasos) {
      return {
        salida: truncarContenido(
          `ERROR: El subagente '${subagente.nombre}' alcanzó su límite de pasos. ${ultimoAsistente}`,
          opciones.maximoContenido,
        ),
        esError: true,
        canceladoPorPadre: false,
      }
    }

    return {
      salida: truncarContenido(ultimoAsistente, opciones.maximoContenido),
      esError: false,
      canceladoPorPadre: false,
    }
  } finally {
    limpiar()
  }
}
