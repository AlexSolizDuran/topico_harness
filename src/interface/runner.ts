import type { RegistroHerramientas } from '../core/registry.js'
import { ejecutarTurno } from '../core/turn.js'
import type { Proveedor } from '../provider/types.js'
import type { EstadoTurno, Mensaje } from '../types.js'
import {
  aplicarEventoTurno,
  crearEstadoInicial,
  type EstadoSesionVisual,
  finalizarTurnoVisual,
  generarIdVisual,
} from './state.js'

export class ErrorTurnoEnCurso extends Error {
  constructor() {
    super('No se puede iniciar un nuevo turno mientras hay otro en curso.')
    this.name = 'ErrorTurnoEnCurso'
  }
}

export interface OpcionesSesion {
  promptSistema?: string | undefined
  proveedor: Proveedor
  registro: RegistroHerramientas
  esInteractivo?: boolean | undefined
  alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
}

/**
 * Orquesta la sesión de interacción entre el usuario y el núcleo,
 * manejando el ciclo de vida del turno y la cancelación.
 */
export class SesionInteractiva {
  private estado: EstadoSesionVisual
  private mensajesHistorial: Mensaje[] = []
  private proveedor: Proveedor
  private registro: RegistroHerramientas
  private controllerActivo?: AbortController | undefined
  private alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined

  constructor(opciones: OpcionesSesion) {
    this.proveedor = opciones.proveedor
    this.registro = opciones.registro
    this.estado = crearEstadoInicial(opciones.promptSistema ?? '')
    this.alActualizar = opciones.alActualizar
  }

  obtenerEstado(): EstadoSesionVisual {
    return this.estado
  }

  private notificar(): void {
    if (this.alActualizar) {
      this.alActualizar(this.estado)
    }
  }

  async enviarMensaje(texto: string): Promise<void> {
    if (this.estado.turnoEnCurso) {
      throw new ErrorTurnoEnCurso()
    }

    // Registrar mensaje del usuario con ID único
    this.estado.historial.push({
      id: generarIdVisual(),
      tipo: 'usuario',
      texto,
    })
    this.estado.turnoEnCurso = true
    this.estado.cancelado = false
    this.notificar()

    this.mensajesHistorial.push({ rol: 'user', contenido: texto })
    this.controllerActivo = new AbortController()

    try {
      const generador = ejecutarTurno({
        proveedor: this.proveedor,
        registro: this.registro,
        mensajes: this.mensajesHistorial,
        sistema: this.estado.promptSistema || undefined,
        senalCancelacion: this.controllerActivo.signal,
      })

      let iter = await generador.next()
      while (!iter.done) {
        this.estado = aplicarEventoTurno(this.estado, iter.value)
        this.notificar()
        iter = await generador.next()
      }

      const estadoFinal: EstadoTurno = iter.value
      this.mensajesHistorial = estadoFinal.mensajes
      const fueCancelado = estadoFinal.tipo === 'cancelado'
      this.estado = finalizarTurnoVisual(this.estado, fueCancelado)
    } catch {
      this.estado = finalizarTurnoVisual(this.estado, false)
    } finally {
      this.controllerActivo = undefined
      this.notificar()
    }
  }

  cancelar(): void {
    if (this.controllerActivo) {
      this.controllerActivo.abort()
    }
  }
}

export function detectarTerminalInteractiva(
  stream: { isTTY?: boolean } = process.stdout,
): boolean {
  return Boolean(stream.isTTY)
}
