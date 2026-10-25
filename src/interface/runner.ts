import {
  crearAgentesPorDefecto,
  listarAgentesPrimarios,
  siguienteAgentePrimario,
} from '../agents/defaults.js'
import {
  type DefinicionAgente,
  esAgentePrimario,
} from '../agents/definiciones.js'
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
import {
  GestorPermisos,
  type ManejadorAprobacionCliente,
} from '../permissions/portero.js'
import { sanitizarTexto } from '../provider/credentials.js'
import type { Proveedor } from '../provider/types.js'
import type {
  DecisionAprobacion,
  EstadoTurno,
  Mensaje,
  PorteroPermisos,
  ReglaPermiso,
  SolicitudAprobacion,
} from '../types.js'
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

export class ErrorCambioAgente extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCambioAgente'
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
  agentes?: DefinicionAgente[] | undefined
  agenteActivo?: string | undefined
  directorioProyecto?: string | undefined
  reglasPermiso?: ReglaPermiso[] | undefined
  portero?: PorteroPermisos | undefined
  manejadorAprobacion?: ManejadorAprobacionCliente | undefined
}

/**
 * Orquesta la sesión entre el usuario y el núcleo: turno, cancelación,
 * presupuesto de contexto, cambio de modelo, agente activo y aprobaciones.
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
  private promptSistemaBase: string
  private agentes: DefinicionAgente[]
  private agentesExplicito: boolean
  private agenteActivo: string
  private gestorPermisos: GestorPermisos
  private porteroExterno?: PorteroPermisos | undefined
  private resolverAprobacionActiva?:
    | ((decision: DecisionAprobacion) => void)
    | undefined

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
    this.promptSistemaBase = opciones.promptSistema ?? ''
    this.agentesExplicito = Boolean(opciones.agentes)
    this.agentes =
      opciones.agentes && opciones.agentes.length > 0
        ? [...opciones.agentes]
        : crearAgentesPorDefecto(this.registro.listarNombres())

    const primarios = listarAgentesPrimarios(this.agentes)
    const inicial = opciones.agenteActivo ?? primarios[0]?.nombre ?? 'build'
    const defInicial = this.agentes.find((a) => a.nombre === inicial)
    if (defInicial && !esAgentePrimario(defInicial)) {
      throw new ErrorCambioAgente(
        `El agente '${inicial}' no es un agente primario.`,
      )
    }
    this.agenteActivo = defInicial?.nombre ?? primarios[0]?.nombre ?? 'build'

    this.porteroExterno = opciones.portero
    this.gestorPermisos = new GestorPermisos({
      directorioProyecto: opciones.directorioProyecto,
      reglasGlobales: opciones.reglasPermiso,
      reglasAgente: defInicial?.permisos,
      esInteractivo: opciones.esInteractivo ?? true,
      manejadorAprobacion:
        opciones.manejadorAprobacion ??
        ((solicitud, senal) => this.esperarDecisionUsuario(solicitud, senal)),
    })

    this.metricas = this.calcularMetricas()
    this.estado = crearEstadoInicial(
      this.componerPromptEfectivo(defInicial),
      this.modeloActivo,
      this.metricas,
      this.agenteActivo,
    )
    this.alActualizar = opciones.alActualizar
  }

  private componerPromptEfectivo(agente?: DefinicionAgente): string {
    const propio = agente?.prompt?.trim() ?? ''
    if (this.promptSistemaBase && propio) {
      return `${this.promptSistemaBase}\n\n${propio}`
    }
    return propio || this.promptSistemaBase
  }

  private esperarDecisionUsuario(
    _solicitud: SolicitudAprobacion,
    senal?: AbortSignal,
  ): Promise<DecisionAprobacion> {
    return new Promise<DecisionAprobacion>((resolve) => {
      const finalizar = (decision: DecisionAprobacion): void => {
        this.resolverAprobacionActiva = undefined
        if (senal) {
          senal.removeEventListener('abort', alAbortar)
        }
        resolve(decision)
      }
      const alAbortar = (): void => finalizar('denegar')
      if (senal) {
        senal.addEventListener('abort', alAbortar, { once: true })
      }
      this.resolverAprobacionActiva = finalizar
    })
  }

  responderAprobacion(decision: DecisionAprobacion): void {
    const resolver = this.resolverAprobacionActiva
    if (resolver) {
      resolver(decision)
    }
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

  obtenerAgenteActivo(): string {
    return this.agenteActivo
  }

  obtenerDefinicionAgenteActivo(): DefinicionAgente | undefined {
    return this.agentes.find((a) => a.nombre === this.agenteActivo)
  }

  listarAgentes(): DefinicionAgente[] {
    return listarAgentesPrimarios(this.agentes)
  }

  listarTodosLosAgentes(): DefinicionAgente[] {
    return [...this.agentes]
  }

  obtenerGestorPermisos(): GestorPermisos {
    return this.gestorPermisos
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

  private obtenerRegistroDelTurno(
    agente: DefinicionAgente | undefined,
  ): RegistroHerramientas {
    if (!agente) return this.registro
    if (!this.agentesExplicito && agente.nombre === 'build') {
      return this.registro
    }
    return this.registro.filtrar(agente.herramientas)
  }

  private obtenerProveedorDelTurno(
    agente: DefinicionAgente | undefined,
  ): Proveedor {
    if (agente?.modelo && this.fabricaProveedor) {
      const barra = agente.modelo.indexOf('/')
      const proveedorId =
        barra > 0 ? agente.modelo.slice(0, barra) : this.proveedor.nombre
      const modeloId =
        barra > 0 ? agente.modelo.slice(barra + 1) : agente.modelo
      if (proveedorId && modeloId) {
        return this.fabricaProveedor(proveedorId, modeloId).proveedor
      }
    }
    return this.proveedor
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
    const defAgente = this.obtenerDefinicionAgenteActivo()
    this.gestorPermisos.establecerReglasAgente(defAgente?.permisos ?? [])

    try {
      const generador = ejecutarTurno({
        proveedor: this.obtenerProveedorDelTurno(defAgente),
        registro: this.obtenerRegistroDelTurno(defAgente),
        mensajes: this.mensajesHistorial,
        sistema: this.estado.promptSistema || undefined,
        senalCancelacion: this.controllerActivo.signal,
        credencialesSanitizar: this.credencialesSanitizar,
        prepararHistorial: (mensajes) => this.prepararHistorialPaso(mensajes),
        portero: this.porteroExterno ?? this.gestorPermisos,
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

  cambiarAgente(nombre: string): void {
    if (this.estado.turnoEnCurso) {
      throw new ErrorCambioAgente(
        'No se puede cambiar de agente mientras hay un turno en curso.',
      )
    }

    const agente = this.agentes.find((a) => a.nombre === nombre)
    if (!agente) {
      throw new ErrorCambioAgente(`El agente '${nombre}' no está configurado.`)
    }
    if (!esAgentePrimario(agente)) {
      throw new ErrorCambioAgente(
        `El agente '${nombre}' es un subagente y no puede ser el agente activo de la sesión.`,
      )
    }

    this.agenteActivo = agente.nombre
    this.gestorPermisos.establecerReglasAgente(agente.permisos ?? [])
    this.estado = {
      ...this.estado,
      agenteActivo: agente.nombre,
      promptSistema: this.componerPromptEfectivo(agente),
    }
    this.notificar()
  }

  ciclarAgente(): string {
    const siguiente = siguienteAgentePrimario(this.agentes, this.agenteActivo)
    this.cambiarAgente(siguiente)
    return this.agenteActivo
  }

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
