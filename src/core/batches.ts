import type {
  EventoTurno,
  Mensaje,
  PorteroPermisos,
  SolicitudAprobacion,
  SolicitudHerramienta,
} from '../types.js'
import {
  despacharHerramienta,
  normalizarArgumentos,
  type ResultadoDespacho,
  validarYFiltrarArgumentos,
} from './dispatch.js'
import type { DetectorLoops } from './loops.js'
import type { RegistroHerramientas } from './registry.js'

export interface LlamadaPreparada {
  llamada: SolicitudHerramienta
  bloqueoLoop?: string | undefined
  rechazoPrevio?: ResultadoDespacho | undefined
}

/**
 * Agrupa en una misma tanda las llamadas consecutivas cuyas herramientas
 * declaran `admiteParalelo === true`. Toda herramienta sin esa marca o con
 * `false` corta la tanda actual y se ejecuta sola en su propia tanda.
 */
export function agruparLlamadasEnTandas(
  llamadas: readonly SolicitudHerramienta[],
  registro: RegistroHerramientas,
): SolicitudHerramienta[][] {
  const tandas: SolicitudHerramienta[][] = []
  let tandaActual: SolicitudHerramienta[] = []

  for (const llamada of llamadas) {
    const herramienta = registro.obtener(llamada.nombre)
    const esParalela = Boolean(herramienta?.admiteParalelo)

    if (esParalela) {
      tandaActual.push(llamada)
      continue
    }

    if (tandaActual.length > 0) {
      tandas.push(tandaActual)
      tandaActual = []
    }
    tandas.push([llamada])
  }

  if (tandaActual.length > 0) {
    tandas.push(tandaActual)
  }

  return tandas
}

async function* resolverPermisosDeTanda(
  items: LlamadaPreparada[],
  registro: RegistroHerramientas,
  portero: PorteroPermisos | undefined,
  senalCancelacion: AbortSignal | undefined,
): AsyncGenerator<EventoTurno, boolean, unknown> {
  if (!portero) return false

  for (const item of items) {
    if (item.bloqueoLoop || item.rechazoPrevio) continue
    const herramienta = registro.obtener(item.llamada.nombre)
    if (!herramienta) continue

    const args = normalizarArgumentos(item.llamada.argumentos)
    const validacion = validarYFiltrarArgumentos(args, herramienta.esquema)
    if (!validacion.valido) continue

    const evaluacion = portero.evaluar(herramienta, validacion.filtrados)
    if (evaluacion.efecto === 'permitir') continue

    if (evaluacion.efecto === 'denegar') {
      item.rechazoPrevio = {
        resultado: `ERROR: Permiso denegado para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}'.\nLa operación no se completó.`,
        esError: true,
      }
      continue
    }

    if (!portero.solicitarAprobacion) {
      item.rechazoPrevio = {
        resultado: `ERROR: Se requiere aprobación interactiva para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}', pero no hay cliente interactivo.\nLa operación no se completó.`,
        esError: true,
      }
      continue
    }

    const solicitud: SolicitudAprobacion = {
      id: item.llamada.id,
      herramienta: herramienta.nombre,
      accion: evaluacion.accion,
      recurso: evaluacion.recurso,
      patronSugerido: evaluacion.patronSugerido,
    }

    yield { tipo: 'espera_aprobacion', solicitud }
    const decision = await portero.solicitarAprobacion(
      solicitud,
      senalCancelacion,
    )
    yield {
      tipo: 'fin_espera_aprobacion',
      id: item.llamada.id,
      decision,
    }

    if (senalCancelacion?.aborted) {
      return true
    }

    if (decision === 'denegar') {
      item.rechazoPrevio = {
        resultado: `ERROR: Aprobación denegada para la acción '${evaluacion.accion}' sobre el recurso '${evaluacion.recurso}'.\nLa operación no se completó.`,
        esError: true,
      }
    }
  }

  return Boolean(senalCancelacion?.aborted)
}

function ejecutarItemTanda(
  item: LlamadaPreparada,
  registro: RegistroHerramientas,
  credenciales: string[] | undefined,
  senalCancelacion: AbortSignal | undefined,
): Promise<ResultadoDespacho> {
  if (item.bloqueoLoop) {
    return Promise.resolve({
      resultado: item.bloqueoLoop,
      esError: true,
    })
  }
  if (item.rechazoPrevio) {
    return Promise.resolve(item.rechazoPrevio)
  }
  return despacharHerramienta(
    item.llamada.nombre,
    item.llamada.argumentos,
    registro,
    {
      credenciales,
      senalCancelacion,
      idLlamada: item.llamada.id,
      omitirGatePermiso: true,
    },
  )
}

async function* correrTandaConcurrente(
  items: LlamadaPreparada[],
  registro: RegistroHerramientas,
  credenciales: string[] | undefined,
  senalCancelacion: AbortSignal | undefined,
  historial: Mensaje[],
): AsyncGenerator<EventoTurno, void, unknown> {
  for (const item of items) {
    yield {
      tipo: 'herramienta_inicio',
      id: item.llamada.id,
      nombre: item.llamada.nombre,
      argumentos: item.llamada.argumentos,
    }
  }

  const resultadosPorIndice = new Array<ResultadoDespacho>(items.length)
  const colaEventos: EventoTurno[] = []
  let notificarLlegada: (() => void) | undefined
  let pendientes = items.length

  const promesas = items.map(async (item, indice) => {
    try {
      const despacho = await ejecutarItemTanda(
        item,
        registro,
        credenciales,
        senalCancelacion,
      )
      resultadosPorIndice[indice] = despacho
    } catch (error) {
      resultadosPorIndice[indice] = {
        resultado: `ERROR: ${error instanceof Error ? error.message : String(error)}\nLa operación no se completó.`,
        esError: true,
      }
    }

    const res = resultadosPorIndice[indice] ?? {
      resultado:
        'ERROR: Operación sin resultado.\nLa operación no se completó.',
      esError: true,
    }

    colaEventos.push({
      tipo: 'herramienta_fin',
      id: item.llamada.id,
      nombre: item.llamada.nombre,
      resultado: res.resultado,
      esError: res.esError,
    })
    pendientes--
    notificarLlegada?.()
  })

  while (pendientes > 0 || colaEventos.length > 0) {
    while (colaEventos.length > 0) {
      const ev = colaEventos.shift()
      if (ev) yield ev
    }
    if (pendientes > 0) {
      await new Promise<void>((resolve) => {
        notificarLlegada = resolve
      })
      notificarLlegada = undefined
    }
  }

  await Promise.allSettled(promesas)

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const res = resultadosPorIndice[i]
    if (!item || !res) continue
    historial.push({
      rol: 'tool',
      idLlamada: item.llamada.id,
      resultado: res.resultado,
    })
  }
}

function completarCanceladasEnHistorial(
  llamadas: readonly SolicitudHerramienta[],
  historial: Mensaje[],
): void {
  const registradas = new Set(
    historial
      .filter((m) => m.rol === 'tool' && m.idLlamada)
      .map((m) => m.idLlamada as string),
  )

  for (const llamada of llamadas) {
    if (!registradas.has(llamada.id)) {
      historial.push({
        rol: 'tool',
        idLlamada: llamada.id,
        resultado:
          'ERROR: Operación cancelada porque se canceló el turno.\nLa operación no se completó.',
      })
    }
  }
}

export interface ContextoEjecucionTandas {
  llamadas: SolicitudHerramienta[]
  registro: RegistroHerramientas
  credenciales?: string[] | undefined
  senalCancelacion?: AbortSignal | undefined
  portero?: PorteroPermisos | undefined
  detectorLoops: DetectorLoops
  historial: Mensaje[]
}

export async function* ejecutarTandasDeHerramientas(
  ctx: ContextoEjecucionTandas,
): AsyncGenerator<EventoTurno, { cancelado: boolean }, unknown> {
  const bloqueoPorId = new Map<string, string>()
  for (const llamada of ctx.llamadas) {
    const racha = ctx.detectorLoops.registrar(
      llamada.nombre,
      llamada.argumentos,
    )
    if (racha.bloqueada && racha.mensaje) {
      bloqueoPorId.set(llamada.id, racha.mensaje)
    }
  }

  const tandas = agruparLlamadasEnTandas(ctx.llamadas, ctx.registro)

  for (const tanda of tandas) {
    if (ctx.senalCancelacion?.aborted) {
      completarCanceladasEnHistorial(ctx.llamadas, ctx.historial)
      return { cancelado: true }
    }

    const items: LlamadaPreparada[] = tanda.map((llamada) => ({
      llamada,
      bloqueoLoop: bloqueoPorId.get(llamada.id),
    }))

    const genPermisos = resolverPermisosDeTanda(
      items,
      ctx.registro,
      ctx.portero,
      ctx.senalCancelacion,
    )
    let iterPermiso = await genPermisos.next()
    while (!iterPermiso.done) {
      yield iterPermiso.value
      iterPermiso = await genPermisos.next()
    }

    if (iterPermiso.value || ctx.senalCancelacion?.aborted) {
      completarCanceladasEnHistorial(ctx.llamadas, ctx.historial)
      return { cancelado: true }
    }

    yield* correrTandaConcurrente(
      items,
      ctx.registro,
      ctx.credenciales,
      ctx.senalCancelacion,
      ctx.historial,
    )

    if (ctx.senalCancelacion?.aborted) {
      completarCanceladasEnHistorial(ctx.llamadas, ctx.historial)
      return { cancelado: true }
    }
  }

  return { cancelado: false }
}
