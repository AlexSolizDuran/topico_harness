import { PresupuestoContexto } from '../context/budget.js'
import {
  type MetricasContexto,
  medirContexto,
  type ResumenCompactacion,
} from '../context/metrics.js'
import { aplicarPipelineContexto } from '../context/pipeline.js'
import {
  calcularTokensHistorial,
  estimarTokensTexto,
} from '../context/tokens.js'
import { recortarSalidasHerramientasViejas } from '../context/trimming.js'
import type { RegistroHerramientas } from '../core/registry.js'
import { ejecutarTurno, type PreparacionHistorial } from '../core/turn.js'
import { sanitizarTexto } from '../provider/credentials.js'
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

export class ErrorCambioModelo extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCambioModelo'
  }
}

export interface ResultadoFabricaProveedor {
  proveedor: Proveedor
  ventanaContexto?: number | undefined
  credencialesSanitizar?: string[] | undefined
}

export type FabricaProveedor = (
  proveedorId: string,
  modeloId: string,
) => ResultadoFabricaProveedor

export interface OpcionesSesion {
  promptSistema?: string | undefined
  proveedor: Proveedor
  registro: RegistroHerramientas
  esInteractivo?: boolean | undefined
  alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
  ventanaContexto?: number | undefined
  credencialesSanitizar?: string[] | undefined
  modelosDisponibles?: string[] | undefined
  modeloActivo?: string | undefined
  fabricaProveedor?: FabricaProveedor | undefined
}

/**
 * Orquesta la sesión entre el usuario y el núcleo: turno, cancelación,
 * presupuesto de contexto y cambio de modelo entre turnos.
 */
export class SesionInteractiva {
  private estado: EstadoSesionVisual
  private mensajesHistorial: Mensaje[] = []
  private proveedor: Proveedor
  private registro: RegistroHerramientas
  private controllerActivo?: AbortController | undefined
  private alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
  private presupuesto: PresupuestoContexto
  private ventanaContexto: number
  private credencialesSanitizar: string[]
  private modelosDisponibles: string[]
  private modeloActivo: string
  private fabricaProveedor?: FabricaProveedor | undefined
  private ultimoTokens?: { entrada: number; salida: number } | undefined
  private ultimoEstadoTurno?: EstadoTurno | undefined
  private tokensAcumulados = 0
  private ultimaCompactacion?: ResumenCompactacion | undefined
  private metricas: MetricasContexto

  constructor(opciones: OpcionesSesion) {
    this.proveedor = opciones.proveedor
    this.registro = opciones.registro
    this.ventanaContexto = opciones.ventanaContexto ?? 128000
    this.presupuesto = new PresupuestoContexto({
      ventanaContexto: this.ventanaContexto,
    })
    this.credencialesSanitizar = opciones.credencialesSanitizar ?? []
    this.modelosDisponibles = opciones.modelosDisponibles ?? []
    this.modeloActivo =
      opciones.modeloActivo ??
      (opciones.proveedor.modelo
        ? `${opciones.proveedor.nombre}/${opciones.proveedor.modelo}`
        : '')
    this.fabricaProveedor = opciones.fabricaProveedor
    this.metricas = this.calcularMetricas()
    this.estado = crearEstadoInicial(
      opciones.promptSistema ?? '',
      this.modeloActivo,
      this.metricas,
    )
    this.alActualizar = opciones.alActualizar
  }

  obtenerEstado(): EstadoSesionVisual {
    return this.estado
  }

  obtenerMetricasContexto(): MetricasContexto {
    return this.metricas
  }

  obtenerUltimoTurno(): EstadoTurno | undefined {
    return this.ultimoEstadoTurno
  }

  obtenerModeloActivo(): string {
    return this.modeloActivo
  }

  listarModelos(): string[] {
    return [...this.modelosDisponibles]
  }

  establecerActualizador(
    alActualizar: ((estado: EstadoSesionVisual) => void) | undefined,
  ): void {
    this.alActualizar = alActualizar
  }

  private calcularMetricas(usarUltimo = true): MetricasContexto {
    return medirContexto(
      this.presupuesto,
      this.mensajesHistorial,
      usarUltimo ? this.ultimoTokens : undefined,
      this.tokensAcumulados,
      this.ultimaCompactacion,
    )
  }

  private actualizarMetricas(usarUltimo = true): void {
    this.metricas = this.calcularMetricas(usarUltimo)
    this.estado = { ...this.estado, contexto: this.metricas }
  }

  private notificar(): void {
    if (this.alActualizar) {
      this.alActualizar(this.estado)
    }
  }

  private agregarAviso(texto: string): void {
    this.estado = {
      ...this.estado,
      historial: [
        ...this.estado.historial,
        { id: generarIdVisual(), tipo: 'aviso', texto },
      ],
    }
  }

  private limpiar(texto: string): string {
    return sanitizarTexto(texto, this.credencialesSanitizar)
  }

  private medirParaEnviar(texto: string): number {
    if (this.ultimoTokens) {
      return (
        this.ultimoTokens.entrada +
        this.ultimoTokens.salida +
        estimarTokensTexto(texto)
      )
    }
    return calcularTokensHistorial([
      ...this.mensajesHistorial,
      { rol: 'user', contenido: texto },
    ]).tokens
  }

  /**
   * Compacta al final del turno, nunca entre pasos. Primero recorta lo barato;
   * solo resume si el recorte no alcanza. Repite la compactación si el historial
   * todavía no entra en el presupuesto.
   */
  private procesarContexto(): void {
    const antes = calcularTokensHistorial(
      this.mensajesHistorial,
      this.ultimoTokens,
    )
    const antesMensajes = this.mensajesHistorial.length
    const resultado = aplicarPipelineContexto(
      this.mensajesHistorial,
      this.presupuesto,
      this.ultimoTokens,
    )
    this.mensajesHistorial = resultado.mensajes
    this.ultimoTokens = resultado.ultimoTokens

    if (resultado.compactado) {
      const despues = calcularTokensHistorial(resultado.mensajes)
      this.ultimaCompactacion = {
        antesTokens: antes.tokens,
        despuesTokens: despues.tokens,
        antesMensajes,
        despuesMensajes: resultado.mensajes.length,
      }
      this.agregarAviso('Historial compactado automáticamente.')
    }
    if (resultado.excedePresupuesto) {
      const tokens = calcularTokensHistorial(resultado.mensajes).tokens
      this.agregarAviso(
        this.limpiar(
          `El contexto sigue por encima del presupuesto (${tokens} > ${this.presupuesto.limitePresupuesto}). No se enviarán más peticiones hasta reducir el historial.`,
        ),
      )
    }
    if (resultado.error) {
      this.agregarAviso(
        this.limpiar(`No se pudo compactar el historial: ${resultado.error}`),
      )
    }
  }

  /**
   * Se ejecuta antes de cada petición del turno. El núcleo no conoce el
   * presupuesto: la sesión le entrega el historial ya preparado o un error.
   */
  private prepararHistorialPaso(mensajes: Mensaje[]): PreparacionHistorial {
    const medicion = calcularTokensHistorial(mensajes)
    if (!this.presupuesto.estaCercaDelLimite(medicion.tokens)) {
      return { mensajes }
    }

    const recortados = recortarSalidasHerramientasViejas(mensajes)
    const trasRecorte = calcularTokensHistorial(recortados)
    if (trasRecorte.tokens <= this.presupuesto.limitePresupuesto) {
      return { mensajes: recortados }
    }

    return {
      mensajes: recortados,
      error: `El historial de este turno superó el presupuesto (${trasRecorte.tokens} > ${this.presupuesto.limitePresupuesto}). El turno se detuvo antes de enviar una petición que excediera el límite.`,
    }
  }

  async enviarMensaje(texto: string): Promise<void> {
    if (this.estado.turnoEnCurso) {
      throw new ErrorTurnoEnCurso()
    }

    try {
      this.presupuesto.validarEnvio(this.medirParaEnviar(texto))
    } catch (error) {
      this.agregarAviso(this.limpiar((error as Error).message))
      this.notificar()
      return
    }

    this.estado.historial.push({
      id: generarIdVisual(),
      tipo: 'usuario',
      texto,
    })
    this.estado.turnoEnCurso = true
    this.estado.cancelado = false
    this.actualizarMetricas(false)
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
        credencialesSanitizar: this.credencialesSanitizar,
        prepararHistorial: (mensajes) => this.prepararHistorialPaso(mensajes),
      })

      let iter = await generador.next()
      while (!iter.done) {
        this.estado = aplicarEventoTurno(this.estado, iter.value)
        this.notificar()
        iter = await generador.next()
      }

      const estadoFinal: EstadoTurno = iter.value
      this.ultimoEstadoTurno = estadoFinal
      this.mensajesHistorial = estadoFinal.mensajes
      this.ultimoTokens = estadoFinal.tokens
      if (estadoFinal.tokens) {
        this.tokensAcumulados +=
          estadoFinal.tokens.entrada + estadoFinal.tokens.salida
      }

      const fueCancelado = estadoFinal.tipo === 'cancelado'
      this.estado = finalizarTurnoVisual(this.estado, fueCancelado)

      if (estadoFinal.tipo === 'fallido') {
        this.agregarAviso(this.limpiar(estadoFinal.motivo))
      }

      this.procesarContexto()
      this.actualizarMetricas()
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      this.estado = finalizarTurnoVisual(this.estado, false)
      this.agregarAviso(this.limpiar(mensaje))
      this.actualizarMetricas()
    } finally {
      this.controllerActivo = undefined
      this.notificar()
    }
  }

  /**
   * Cambio atómico: todo se resuelve antes de tocar el estado de la sesión.
   */
  cambiarModelo(id: string): void {
    if (this.estado.turnoEnCurso) {
      throw new ErrorCambioModelo(
        'No se puede cambiar de modelo mientras hay un turno en curso.',
      )
    }
    if (!this.fabricaProveedor) {
      throw new ErrorCambioModelo('La sesión no tiene una fábrica de modelos.')
    }
    if (
      this.modelosDisponibles.length > 0 &&
      !this.modelosDisponibles.includes(id)
    ) {
      throw new ErrorCambioModelo(`El modelo '${id}' no está configurado.`)
    }

    const barra = id.indexOf('/')
    const proveedorId = barra > 0 ? id.slice(0, barra) : this.proveedor.nombre
    const modeloId = barra > 0 ? id.slice(barra + 1) : id
    if (!proveedorId || !modeloId) {
      throw new ErrorCambioModelo(`El modelo '${id}' no es válido.`)
    }

    const resuelto = this.fabricaProveedor(proveedorId, modeloId)
    const nuevaVentana = resuelto.ventanaContexto ?? this.ventanaContexto

    this.proveedor = resuelto.proveedor
    this.ventanaContexto = nuevaVentana
    this.presupuesto = new PresupuestoContexto({
      ventanaContexto: nuevaVentana,
    })
    if (resuelto.credencialesSanitizar) {
      this.credencialesSanitizar = resuelto.credencialesSanitizar
    }
    this.modeloActivo = id
    this.ultimoTokens = undefined
    this.metricas = this.calcularMetricas(false)
    this.estado = {
      ...this.estado,
      modeloActivo: id,
      contexto: this.metricas,
    }
    this.notificar()
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
