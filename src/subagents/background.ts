import {
  MAXIMO_CONTENIDO_POR_DEFECTO,
  truncarContenido,
} from '../tools/truncate.js'

export type EstadoTareaBackground =
  | 'en_curso'
  | 'completada'
  | 'cancelada'
  | 'fallida'

export interface TareaBackground {
  id: string
  agente: string
  pedido: string
  estado: EstadoTareaBackground
  resultado?: string | undefined
  iniciadaEn: number
  terminadaEn?: number | undefined
}

export interface OpcionesGestorTareas {
  maximo?: number | undefined
  maximoContenido?: number | undefined
  ahora?: (() => number) | undefined
  generarId?: (() => string) | undefined
}

export interface OpcionesIniciarTarea {
  agente: string
  pedido: string
  ejecutar: (senal: AbortSignal) => Promise<string>
}

export class ErrorTareaBackground extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorTareaBackground'
  }
}

interface TareaInterna {
  publica: TareaBackground
  controlador: AbortController
  promesa: Promise<void>
}

export const MAXIMO_TAREAS_BACKGROUND = 4
export const MAXIMO_CONTINUACIONES_BACKGROUND = 8

function copiar(tarea: TareaBackground): TareaBackground {
  return { ...tarea }
}

export function describirTarea(
  tarea: TareaBackground,
  incluirResultado = true,
): string {
  const cabecera = `${tarea.id} · ${tarea.agente} · ${tarea.estado}`
  if (!incluirResultado || tarea.estado === 'en_curso') {
    return `${cabecera} · ${tarea.pedido}`
  }
  return `${cabecera}\n${tarea.resultado ?? '(sin resultado)'}`
}

/**
 * Coordina tareas de subagente que corren mientras el padre sigue trabajando.
 * Una tarea nunca tira: su error se guarda como resultado fallido para que el
 * turno del padre pueda leerlo como texto.
 */
export class GestorTareasBackground {
  private readonly tareas = new Map<string, TareaInterna>()
  private readonly inyectadas = new Set<string>()
  private readonly maximo: number
  private readonly maximoContenido: number
  private readonly ahora: () => number
  private readonly generarId: () => string
  private contador = 0
  private observador?:
    | ((tareas: readonly TareaBackground[]) => void)
    | undefined

  constructor(opciones: OpcionesGestorTareas = {}) {
    this.maximo = Math.max(1, opciones.maximo ?? MAXIMO_TAREAS_BACKGROUND)
    this.maximoContenido =
      opciones.maximoContenido ?? MAXIMO_CONTENIDO_POR_DEFECTO
    this.ahora = opciones.ahora ?? (() => Date.now())
    this.generarId = opciones.generarId ?? (() => `tarea-${++this.contador}`)
  }

  establecerObservador(
    observador: ((tareas: readonly TareaBackground[]) => void) | undefined,
  ): void {
    this.observador = observador
    this.notificar()
  }

  listar(): TareaBackground[] {
    return [...this.tareas.values()].map((tarea) => copiar(tarea.publica))
  }

  obtener(id: string): TareaBackground | undefined {
    const tarea = this.tareas.get(id)
    return tarea ? copiar(tarea.publica) : undefined
  }

  tareasEnCurso(): TareaBackground[] {
    return this.listar().filter((tarea) => tarea.estado === 'en_curso')
  }

  hayPendientes(): boolean {
    return this.tareasEnCurso().length > 0
  }

  /** Tareas terminadas cuyo resultado todavía no se inyectó en el padre. */
  hayResultadosPendientes(): boolean {
    return this.listar().some(
      (tarea) => tarea.estado !== 'en_curso' && !this.inyectadas.has(tarea.id),
    )
  }

  iniciar(opciones: OpcionesIniciarTarea): TareaBackground {
    if (this.hayPendientes() && this.tareasEnCurso().length >= this.maximo) {
      throw new ErrorTareaBackground(
        `Ya hay ${this.maximo} tareas en background en curso. Esperá a que termine alguna o cancelala con task_cancel.`,
      )
    }

    let id = ''
    for (let intento = 0; intento < 5; intento++) {
      id = this.generarId()
      if (!this.tareas.has(id)) break
    }
    if (this.tareas.has(id)) {
      throw new ErrorTareaBackground(
        'No se pudo generar un identificador libre para la tarea.',
      )
    }

    const publica: TareaBackground = {
      id,
      agente: opciones.agente,
      pedido: opciones.pedido,
      estado: 'en_curso',
      iniciadaEn: this.ahora(),
    }
    const controlador = new AbortController()
    const promesa = this.ejecutarTarea(publica, controlador, opciones.ejecutar)
    this.tareas.set(id, { publica, controlador, promesa })
    this.notificar()
    return copiar(publica)
  }

  private async ejecutarTarea(
    publica: TareaBackground,
    controlador: AbortController,
    ejecutar: (senal: AbortSignal) => Promise<string>,
  ): Promise<void> {
    try {
      const salida = await ejecutar(controlador.signal)
      publica.resultado = truncarContenido(salida, this.maximoContenido)
      publica.estado = 'completada'
    } catch (error) {
      if (controlador.signal.aborted) {
        publica.estado = 'cancelada'
        publica.resultado = 'La tarea fue cancelada.'
      } else {
        publica.estado = 'fallida'
        publica.resultado = `ERROR: ${(error as Error).message}\nLa operación no se completó.`
      }
    } finally {
      publica.terminadaEn = this.ahora()
      this.notificar()
    }
  }

  cancelar(id: string): boolean {
    const tarea = this.tareas.get(id)
    if (!tarea || tarea.publica.estado !== 'en_curso') return false
    tarea.controlador.abort()
    return true
  }

  cancelarTodas(): void {
    for (const tarea of this.tareas.values()) {
      if (tarea.publica.estado === 'en_curso') {
        tarea.controlador.abort()
      }
    }
  }

  async esperarTodas(): Promise<TareaBackground[]> {
    const pendientes = [...this.tareas.values()]
      .filter((tarea) => tarea.publica.estado === 'en_curso')
      .map((tarea) => tarea.promesa)
    await Promise.all(pendientes)
    return this.listar()
  }

  /**
   * Devuelve un bloque con las tareas terminadas que todavía no se inyectaron
   * y las marca. Una tarea nunca se inyecta dos veces.
   */
  consumirResultados(): string | undefined {
    const terminadas = this.listar().filter(
      (tarea) => tarea.estado !== 'en_curso' && !this.inyectadas.has(tarea.id),
    )
    if (terminadas.length === 0) return undefined

    const lineas = ['[Resultados de tareas en background]']
    for (const tarea of terminadas) {
      this.inyectadas.add(tarea.id)
      if (tarea.estado === 'completada') {
        lineas.push(
          `- ${tarea.id} · ${tarea.agente} · completada\n${tarea.resultado ?? '(sin resultado)'}`,
        )
      } else if (tarea.estado === 'cancelada') {
        lineas.push(`- ${tarea.id} · ${tarea.agente} · cancelada`)
      } else {
        lineas.push(
          `- ${tarea.id} · ${tarea.agente} · fallida\n${tarea.resultado ?? '(sin resultado)'}`,
        )
      }
    }
    return truncarContenido(lineas.join('\n'), this.maximoContenido)
  }

  private notificar(): void {
    this.observador?.(this.listar())
  }
}
