import {
  crearAgentesPorDefecto,
  listarAgentesPrimarios,
  siguienteAgentePrimario,
} from '../agents/defaults.js'
import {
  type DefinicionAgente,
  esAgentePrimario,
} from '../agents/definiciones.js'
import {
  type ConfiguracionUmbralesContexto,
  type EtapaContexto,
  PresupuestoContexto,
} from '../context/budget.js'
import {
  type MetricasContexto,
  medirContexto,
  type ResumenCompactacion,
} from '../context/metrics.js'
import { aplicarPipelineContexto } from '../context/pipeline.js'
import { podarPasosLectura } from '../context/pruning.js'
import {
  calcularTokensHistorial,
  estimarTokensTexto,
} from '../context/tokens.js'
import { recortarSalidasHerramientasViejas } from '../context/trimming.js'
import type { RegistroHerramientas } from '../core/registry.js'
import { ejecutarTurno, type PreparacionHistorial } from '../core/turn.js'
import { ErrorBloqueoHook, type GestorHooks } from '../hooks/ejecutar.js'
import type { GestorInstrucciones } from '../instructions/cargar-instrucciones.js'
import {
  GestorPermisos,
  type ManejadorAprobacionCliente,
} from '../permissions/portero.js'
import { sanitizarTexto } from '../provider/credentials.js'
import type { Proveedor } from '../provider/types.js'
import type {
  AlmacenSesiones,
  ResultadoBusquedaSesion,
  SesionCargada,
  SesionMetadata,
} from '../sesiones/index.js'
import {
  type GestorTareasBackground,
  MAXIMO_CONTINUACIONES_BACKGROUND,
} from '../subagents/background.js'
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
  convertirMensajesAHistorial,
  crearEstadoInicial,
  type EstadoSesionVisual,
  type EstadoSkillVisual,
  finalizarTurnoVisual,
  generarIdVisual,
  type SkillOmitidaVisual,
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

export class ErrorCambioSesion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCambioSesion'
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
  umbralesContexto?: ConfiguracionUmbralesContexto | undefined
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
  almacen?: AlmacenSesiones | undefined
  sesionInicial?: SesionCargada | undefined
  gestorTareas?: GestorTareasBackground | undefined
  instruccionesProyecto?: string | undefined
  tokensSistemaInstrucciones?: number | undefined
  gestorInstrucciones?: GestorInstrucciones | undefined
  skills?: EstadoSkillVisual[] | undefined
  skillsOmitidas?: SkillOmitidaVisual[] | undefined
  avisosIniciales?: string[] | undefined
  gestorHooks?: GestorHooks | undefined
  sessionStartPendiente?: boolean | undefined
}

/**
 * Orquesta la sesión entre el usuario y el núcleo: turno, cancelación,
 * presupuesto de contexto, cambio de modelo, agente activo y aprobaciones.
 */
function resolverAgenteInicial(
  agentes: DefinicionAgente[],
  primarios: DefinicionAgente[],
  solicitado: string | undefined,
): string {
  const inicial = solicitado ?? primarios[0]?.nombre ?? 'build'
  const definicion = agentes.find((a) => a.nombre === inicial)
  if (definicion && !esAgentePrimario(definicion)) {
    throw new ErrorCambioAgente(
      `El agente '${inicial}' no es un agente primario.`,
    )
  }
  return definicion?.nombre ?? primarios[0]?.nombre ?? 'build'
}

export class SesionInteractiva {
  private estado: EstadoSesionVisual
  private mensajesHistorial: Mensaje[] = []
  private proveedor: Proveedor
  private registro: RegistroHerramientas
  private controllerActivo?: AbortController | undefined
  private alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
  private presupuesto: PresupuestoContexto
  private ventanaContexto: number
  private umbralesContexto?: ConfiguracionUmbralesContexto | undefined
  private credencialesSanitizar: string[]
  private modelosDisponibles: string[]
  private modeloActivo: string
  private fabricaProveedor?: FabricaProveedor | undefined
  private ultimoTokens?: { entrada: number; salida: number } | undefined
  private ultimoEstadoTurno?: EstadoTurno | undefined
  private tokensAcumulados = 0
  private ultimaCompactacion?: ResumenCompactacion | undefined
  private ultimaEtapaContexto?: EtapaContexto | undefined
  private ultimosTokensRecuperados?: number | undefined
  private umbralesAvisadosTurno = new Set<string>()
  private metricas: MetricasContexto
  private promptSistemaBase: string
  private instruccionesProyecto: string
  private tokensSistemaInstrucciones = 0
  private gestorInstrucciones?: GestorInstrucciones | undefined
  private anunciosSkills: string[] = []
  private skillsListado: EstadoSkillVisual[] = []
  private skillsOmitidas: SkillOmitidaVisual[] = []
  private agentes: DefinicionAgente[]
  private agentesExplicito: boolean
  private agenteActivo: string
  private gestorPermisos: GestorPermisos
  private porteroExterno?: PorteroPermisos | undefined
  private gestorHooks?: GestorHooks | undefined
  private sessionStartPendiente: boolean
  private sessionEndEjecutado = false
  private almacen?: AlmacenSesiones | undefined
  private sesion?: SesionMetadata | undefined
  private gestorTareas?: GestorTareasBackground | undefined
  private resolverAprobacionActiva?:
    | ((decision: DecisionAprobacion) => void)
    | undefined
  private cancelacionSolicitada = false

  constructor(opciones: OpcionesSesion) {
    this.proveedor = opciones.proveedor
    this.registro = opciones.registro
    this.ventanaContexto = opciones.ventanaContexto ?? 128000
    this.umbralesContexto = opciones.umbralesContexto
    this.presupuesto = new PresupuestoContexto({
      ventanaContexto: this.ventanaContexto,
      umbrales: this.umbralesContexto,
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
    this.gestorInstrucciones = opciones.gestorInstrucciones
    this.instruccionesProyecto =
      opciones.instruccionesProyecto ??
      this.gestorInstrucciones?.obtenerContenido() ??
      ''
    this.tokensSistemaInstrucciones =
      opciones.tokensSistemaInstrucciones ??
      (this.instruccionesProyecto
        ? estimarTokensTexto(this.instruccionesProyecto)
        : 0)
    this.skillsListado = (opciones.skills ?? []).map((s) => ({
      ...s,
      cargada: Boolean(s.cargada),
    }))
    this.skillsOmitidas = opciones.skillsOmitidas
      ? [...opciones.skillsOmitidas]
      : []
    this.agentesExplicito = Boolean(opciones.agentes)
    this.agentes =
      opciones.agentes && opciones.agentes.length > 0
        ? [...opciones.agentes]
        : crearAgentesPorDefecto(this.registro.listarNombres())

    const primarios = listarAgentesPrimarios(this.agentes)
    this.agenteActivo = resolverAgenteInicial(
      this.agentes,
      primarios,
      opciones.agenteActivo,
    )

    this.almacen = opciones.almacen
    this.sesion = opciones.sesionInicial?.metadata
    if (opciones.sesionInicial) {
      this.restaurarDesdeSesion(opciones.sesionInicial)
    }
    const errorSesion = this.asegurarSesion()

    const definicionActiva = this.agentes.find(
      (a) => a.nombre === this.agenteActivo,
    )

    this.porteroExterno = opciones.portero
    this.gestorPermisos = new GestorPermisos({
      directorioProyecto: opciones.directorioProyecto,
      reglasGlobales: opciones.reglasPermiso,
      reglasAgente: definicionActiva?.permisos,
      esInteractivo: opciones.esInteractivo ?? true,
      manejadorAprobacion:
        opciones.manejadorAprobacion ??
        ((solicitud, senal) => this.esperarDecisionUsuario(solicitud, senal)),
    })

    this.gestorHooks = opciones.gestorHooks
    this.sessionStartPendiente = Boolean(opciones.sessionStartPendiente)

    this.recalcularAnunciosSkills()
    this.metricas = this.calcularMetricas(false)
    this.estado = crearEstadoInicial(
      this.componerPromptEfectivo(definicionActiva),
      this.modeloActivo,
      this.metricas,
      this.agenteActivo,
      {
        historial: opciones.sesionInicial
          ? convertirMensajesAHistorial(this.mensajesHistorial)
          : undefined,
        sesionId: this.sesion?.id,
        skills: this.obtenerSkillsVisiblesEstado(),
        skillsOmitidas: this.skillsOmitidas,
      },
    )
    this.avisarSesionInicial(opciones.sesionInicial, errorSesion)
    if (opciones.avisosIniciales) {
      for (const aviso of opciones.avisosIniciales) {
        this.agregarAviso(this.limpiar(aviso))
      }
    }
    this.alActualizar = opciones.alActualizar
    this.gestorTareas = opciones.gestorTareas
    this.gestorTareas?.establecerObservador((tareas) => {
      const enCurso = tareas.filter(
        (tarea) => tarea.estado === 'en_curso',
      ).length
      if (enCurso === (this.estado.tareasBackground ?? 0)) return
      this.estado = { ...this.estado, tareasBackground: enCurso }
      this.notificar()
    })
  }

  private obtenerPorteroActivo(): PorteroPermisos {
    return this.porteroExterno ?? this.gestorPermisos
  }

  private obtenerSkillsVisiblesEstado(): EstadoSkillVisual[] {
    const portero = this.obtenerPorteroActivo()
    return this.skillsListado.filter(
      (s) =>
        portero.evaluar(
          {
            nombre: 'skill',
            accionPermiso: 'skill',
            obtenerRecurso: () => s.id,
          },
          { id: s.id },
        ).efecto !== 'denegar',
    )
  }

  private recalcularAnunciosSkills(): void {
    const visibles = this.obtenerSkillsVisiblesEstado()
    this.anunciosSkills = visibles.map(
      (s) => `- skill:${s.id} | ${s.nombre} | ${s.descripcion}`,
    )
  }

  marcarSkillCargada(id: string): void {
    let modificada = false
    this.skillsListado = this.skillsListado.map((s) => {
      if (s.id === id && !s.cargada) {
        modificada = true
        return { ...s, cargada: true }
      }
      return s
    })
    if (modificada) {
      this.estado = {
        ...this.estado,
        skills: this.obtenerSkillsVisiblesEstado(),
      }
      this.notificar()
    }
  }

  private restaurarDesdeSesion(cargada: SesionCargada): void {
    this.mensajesHistorial = [...cargada.mensajes]
    if (cargada.metadata.modelo) {
      try {
        this.aplicarModelo(cargada.metadata.modelo)
      } catch {
        // El historial se conserva; el modelo guardado ya no está disponible.
      }
    }
    const guardado = this.agentes.find(
      (a) => a.nombre === cargada.metadata.agente,
    )
    if (guardado && esAgentePrimario(guardado)) {
      this.agenteActivo = guardado.nombre
    }
  }

  private asegurarSesion(): string | undefined {
    if (!this.almacen || this.sesion) return undefined
    try {
      this.sesion = this.almacen.crear({
        modelo: this.modeloActivo,
        agente: this.agenteActivo,
      })
      return undefined
    } catch (error) {
      this.almacen = undefined
      return error instanceof Error ? error.message : String(error)
    }
  }

  private avisarSesionInicial(
    cargada: SesionCargada | undefined,
    errorSesion: string | undefined,
  ): void {
    if (cargada) {
      this.agregarAviso(
        `Sesión reanudada: ${cargada.metadata.id} (${this.mensajesHistorial.length} mensajes).`,
      )
    }
    if (errorSesion) {
      this.agregarAviso(
        `No se pudo iniciar el guardado de la sesión: ${errorSesion}`,
      )
    }
  }

  private componerPromptEfectivo(agente?: DefinicionAgente): string {
    const propio = agente?.prompt?.trim() ?? ''
    const partes: string[] = []
    if (this.promptSistemaBase) partes.push(this.promptSistemaBase)
    if (this.instruccionesProyecto) partes.push(this.instruccionesProyecto)
    if (this.anunciosSkills.length > 0) {
      partes.push(`Skills disponibles:\n${this.anunciosSkills.join('\n')}`)
    }
    if (propio) partes.push(propio)
    return partes.join('\n\n')
  }

  /**
   * Devuelve el prompt base actual del padre (incluyendo las instrucciones
   * de proyecto ya cargadas y el catálogo de skills visibles) para que un
   * subagente herede ese contexto sin cargar instrucciones por su cuenta.
   */
  obtenerPromptBaseParaSubagente(): string | undefined {
    const partes: string[] = []
    if (this.promptSistemaBase) partes.push(this.promptSistemaBase)
    if (this.instruccionesProyecto) partes.push(this.instruccionesProyecto)
    if (this.anunciosSkills.length > 0) {
      partes.push(`Skills disponibles:\n${this.anunciosSkills.join('\n')}`)
    }
    const unido = partes.join('\n\n')
    return unido || undefined
  }

  private manejarRutasExploradas(
    rutas: readonly string[],
    agente: DefinicionAgente | undefined,
  ): {
    cargadas: Array<{
      rutaRelativa: string
      tamanioBytes: number
      tokens: number
    }>
    errores: string[]
  } {
    if (!this.gestorInstrucciones) {
      return { cargadas: [], errores: [] }
    }
    const res = this.gestorInstrucciones.explorarRutas(rutas)
    if (res.cargadas.length > 0) {
      this.instruccionesProyecto = this.gestorInstrucciones.obtenerContenido()
      this.tokensSistemaInstrucciones = estimarTokensTexto(
        this.instruccionesProyecto,
      )
      this.estado = {
        ...this.estado,
        promptSistema: this.componerPromptEfectivo(agente),
      }
      this.actualizarMetricas()
    }
    return res
  }

  private esperarDecisionUsuario(
    solicitud: SolicitudAprobacion,
    senal?: AbortSignal,
  ): Promise<DecisionAprobacion> {
    return new Promise<DecisionAprobacion>((resolve) => {
      const pusoEsperaPropia = !this.estado.esperandoAprobacion
      if (pusoEsperaPropia) {
        this.estado = aplicarEventoTurno(this.estado, {
          tipo: 'espera_aprobacion',
          solicitud,
        })
        this.notificar()
      }
      const finalizar = (decision: DecisionAprobacion): void => {
        this.resolverAprobacionActiva = undefined
        if (senal) {
          senal.removeEventListener('abort', alAbortar)
        }
        if (pusoEsperaPropia) {
          this.estado = aplicarEventoTurno(this.estado, {
            tipo: 'fin_espera_aprobacion',
            id: solicitud.id,
            decision,
          })
          this.notificar()
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

  private calcularTokensSkills(): number {
    return this.anunciosSkills.reduce(
      (acc, linea) => acc + estimarTokensTexto(linea),
      0,
    )
  }

  private calcularMetricas(usarUltimo = true): MetricasContexto {
    const tokensSkills = this.calcularTokensSkills()
    return medirContexto(
      this.presupuesto,
      this.mensajesHistorial,
      usarUltimo ? this.ultimoTokens : undefined,
      this.tokensAcumulados,
      this.ultimaCompactacion,
      {
        tokensSistema: this.tokensSistemaInstrucciones,
        tokensSkills,
        etapaAplicada: this.ultimaEtapaContexto,
        tokensRecuperados: this.ultimosTokensRecuperados,
      },
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

  private aplicarModelo(id: string): void {
    if (!this.fabricaProveedor || !id) return
    const barra = id.indexOf('/')
    const proveedorId = barra > 0 ? id.slice(0, barra) : this.proveedor.nombre
    const modeloId = barra > 0 ? id.slice(barra + 1) : id
    if (!proveedorId || !modeloId) return

    const resuelto = this.fabricaProveedor(proveedorId, modeloId)
    this.proveedor = resuelto.proveedor
    this.ventanaContexto = resuelto.ventanaContexto ?? this.ventanaContexto
    this.presupuesto = new PresupuestoContexto({
      ventanaContexto: this.ventanaContexto,
      umbrales: this.umbralesContexto,
    })
    if (resuelto.credencialesSanitizar) {
      this.credencialesSanitizar = resuelto.credencialesSanitizar
    }
    this.modeloActivo = id
    this.ultimoTokens = undefined
  }

  private actualizarMetadataSesion(cambios: {
    modelo?: string
    agente?: string
  }): void {
    if (!this.almacen || !this.sesion) return
    try {
      this.sesion = this.almacen.actualizarMetadata(this.sesion.id, cambios)
    } catch (error) {
      this.agregarAviso(
        this.limpiar(
          `No se pudieron actualizar los metadatos de la sesión: ${(error as Error).message}`,
        ),
      )
    }
  }

  private persistirTurno(estado: EstadoTurno, mensajes: Mensaje[]): void {
    if (!this.almacen || !this.sesion || mensajes.length === 0) return
    try {
      this.almacen.guardarTurno(
        this.sesion.id,
        estado.tipo,
        mensajes,
        this.credencialesSanitizar,
      )
    } catch (error) {
      this.agregarAviso(
        this.limpiar(
          `No se pudo guardar el turno en la sesión: ${(error as Error).message}`,
        ),
      )
    }
  }

  private persistirCompactacion(): void {
    if (!this.almacen || !this.sesion) return
    try {
      this.almacen.guardarCompactacion(
        this.sesion.id,
        this.mensajesHistorial,
        this.credencialesSanitizar,
      )
    } catch (error) {
      this.agregarAviso(
        this.limpiar(
          `No se pudo guardar la compactación en la sesión: ${(error as Error).message}`,
        ),
      )
    }
  }

  private medirParaEnviar(texto: string): number {
    if (this.ultimoTokens) {
      return (
        this.ultimoTokens.entrada +
        this.ultimoTokens.salida +
        estimarTokensTexto(texto)
      )
    }
    const tokensMensajes = calcularTokensHistorial([
      ...this.mensajesHistorial,
      { rol: 'user', contenido: texto },
    ]).tokens
    return (
      tokensMensajes +
      this.tokensSistemaInstrucciones +
      this.calcularTokensSkills()
    )
  }

  private emitirAvisoUmbralUnaVez(porcentaje: number): void {
    if (this.umbralesAvisadosTurno.has('aviso')) return
    this.umbralesAvisadosTurno.add('aviso')
    this.agregarAviso(
      `Se alcanzó el ${Math.round(porcentaje)}% del presupuesto de contexto.`,
    )
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
    this.ultimaEtapaContexto = resultado.etapaAplicada
    this.ultimosTokensRecuperados = resultado.tokensRecuperados

    if (resultado.etapaAplicada !== 'ninguna') {
      this.emitirAvisoUmbralUnaVez(
        resultado.avisoUmbral ?? resultado.porcentajeUso,
      )
    }

    if (resultado.compactado) {
      const despues = calcularTokensHistorial(resultado.mensajes)
      this.ultimaCompactacion = {
        antesTokens: antes.tokens,
        despuesTokens: despues.tokens,
        antesMensajes,
        despuesMensajes: resultado.mensajes.length,
      }
      this.agregarAviso('Historial compactado automáticamente.')
      this.persistirCompactacion()
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
    if (this.presupuesto.alcanzaUmbral('aviso', medicion.tokens)) {
      this.emitirAvisoUmbralUnaVez(
        this.presupuesto.porcentajeSobreLimite(medicion.tokens),
      )
    }

    if (!this.presupuesto.alcanzaUmbral('enmascarar', medicion.tokens)) {
      return { mensajes }
    }

    let actuales = recortarSalidasHerramientasViejas(mensajes)
    let trasPaso = calcularTokensHistorial(actuales)

    if (this.presupuesto.alcanzaUmbral('podar', trasPaso.tokens)) {
      actuales = podarPasosLectura(actuales)
      trasPaso = calcularTokensHistorial(actuales)
    }

    if (trasPaso.tokens <= this.presupuesto.limitePresupuesto) {
      return { mensajes: actuales }
    }

    return {
      mensajes: actuales,
      error: `El historial de este turno superó el presupuesto (${trasPaso.tokens} > ${this.presupuesto.limitePresupuesto}). El turno se detuvo antes de enviar una petición que excediera el límite.`,
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

  async iniciarSesion(): Promise<void> {
    if (!this.sessionStartPendiente || !this.gestorHooks) return
    this.sessionStartPendiente = false
    const res = await this.gestorHooks.ejecutar({ evento: 'sessionStart' })
    for (const aviso of res.avisos) {
      this.agregarAviso(this.limpiar(aviso))
    }
    if (res.bloqueado) {
      const motivo =
        res.mensajeBloqueo ?? 'El arranque fue bloqueado por sessionStart.'
      this.agregarAviso(this.limpiar(motivo))
      this.notificar()
      throw new ErrorBloqueoHook('sessionStart', motivo)
    }
    this.notificar()
  }

  async cerrarSesion(): Promise<void> {
    if (this.sessionEndEjecutado || !this.gestorHooks) return
    this.sessionEndEjecutado = true
    const res = await this.gestorHooks.ejecutar({ evento: 'sessionEnd' })
    for (const aviso of res.avisos) {
      this.agregarAviso(this.limpiar(aviso))
    }
    this.notificar()
  }

  async enviarMensaje(texto: string): Promise<void> {
    if (this.estado.turnoEnCurso) {
      throw new ErrorTurnoEnCurso()
    }

    if (this.sessionStartPendiente) {
      await this.iniciarSesion()
    }

    try {
      this.presupuesto.validarEnvio(this.medirParaEnviar(texto))
    } catch (error) {
      this.agregarAviso(this.limpiar((error as Error).message))
      this.notificar()
      return
    }

    this.umbralesAvisadosTurno.clear()
    this.estado.historial.push({
      id: generarIdVisual(),
      tipo: 'usuario',
      texto,
    })
    this.estado.turnoEnCurso = true
    this.estado.cancelado = false
    this.cancelacionSolicitada = false
    this.actualizarMetricas(false)
    this.notificar()

    const indiceInicial = this.mensajesHistorial.length
    this.mensajesHistorial.push({ rol: 'user', contenido: texto })

    let indicePersistido = await this.ejecutarIteracion(indiceInicial)
    let continuaciones = 0

    while (
      !this.cancelacionSolicitada &&
      this.ultimoEstadoTurno?.tipo === 'completado' &&
      this.gestorTareas &&
      (this.gestorTareas.hayPendientes() ||
        this.gestorTareas.hayResultadosPendientes())
    ) {
      if (continuaciones >= MAXIMO_CONTINUACIONES_BACKGROUND) {
        this.agregarAviso(
          `Se alcanzó el límite de ${MAXIMO_CONTINUACIONES_BACKGROUND} continuaciones con tareas en background.`,
        )
        this.notificar()
        break
      }

      this.estado = { ...this.estado, turnoEnCurso: true }

      if (this.gestorTareas.hayPendientes()) {
        const pendientes = this.gestorTareas.tareasEnCurso().length
        this.agregarAviso(
          this.limpiar(
            `Esperando ${pendientes} tarea(s) en background antes de continuar…`,
          ),
        )
        this.notificar()

        await this.gestorTareas.esperarTodas()
        if (this.cancelacionSolicitada) break
      }

      const resultados = this.gestorTareas.consumirResultados()
      if (!resultados) break

      this.mensajesHistorial.push({ rol: 'user', contenido: resultados })
      this.estado = {
        ...this.estado,
        historial: [
          ...this.estado.historial,
          { id: generarIdVisual(), tipo: 'usuario', texto: resultados },
        ],
      }
      continuaciones++
      indicePersistido = await this.ejecutarIteracion(indicePersistido)
    }

    this.estado = { ...this.estado, turnoEnCurso: false }
    this.notificar()
  }

  /**
   * Ejecuta un turno completo del núcleo y persiste la diferencia de mensajes
   * desde `indicePersistido`. Devuelve el nuevo punto de corte, ya sea el
   * historial completo o el compactado.
   */
  private async ejecutarIteracion(indicePersistido: number): Promise<number> {
    this.controllerActivo = new AbortController()
    const defAgente = this.obtenerDefinicionAgenteActivo()
    this.gestorPermisos.establecerReglasAgente(defAgente?.permisos ?? [])
    this.recalcularAnunciosSkills()

    try {
      const generador = ejecutarTurno({
        proveedor: this.obtenerProveedorDelTurno(defAgente),
        registro: this.obtenerRegistroDelTurno(defAgente),
        mensajes: this.mensajesHistorial,
        sistema: () => this.componerPromptEfectivo(defAgente) || undefined,
        senalCancelacion: this.controllerActivo.signal,
        credencialesSanitizar: this.credencialesSanitizar,
        prepararHistorial: (mensajes) => this.prepararHistorialPaso(mensajes),
        portero: this.obtenerPorteroActivo(),
        alExplorarRutas: (rutas) =>
          this.manejarRutasExploradas(rutas, defAgente),
        hooks: this.gestorHooks,
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

      this.persistirTurno(
        estadoFinal,
        this.mensajesHistorial.slice(indicePersistido),
      )
      this.procesarContexto()
      this.actualizarMetricas()
      return this.mensajesHistorial.length
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      this.estado = finalizarTurnoVisual(this.estado, false)
      this.agregarAviso(this.limpiar(mensaje))
      this.actualizarMetricas()
      return this.mensajesHistorial.length
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
    this.recalcularAnunciosSkills()
    this.metricas = this.calcularMetricas()
    this.estado = {
      ...this.estado,
      agenteActivo: agente.nombre,
      promptSistema: this.componerPromptEfectivo(agente),
      contexto: this.metricas,
      skills: this.obtenerSkillsVisiblesEstado(),
    }
    this.actualizarMetadataSesion({ agente: agente.nombre })
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
      umbrales: this.umbralesContexto,
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
    this.actualizarMetadataSesion({ modelo: id })
    this.notificar()
  }

  obtenerSesionId(): string | undefined {
    return this.sesion?.id
  }

  listarSesiones(): SesionMetadata[] {
    return this.almacen?.listar() ?? []
  }

  nuevaSesion(): string {
    if (this.estado.turnoEnCurso) {
      throw new ErrorCambioSesion(
        'No se puede crear una sesión mientras hay un turno en curso.',
      )
    }
    if (!this.almacen) {
      throw new ErrorCambioSesion(
        'El guardado de sesiones está desactivado en esta ejecución.',
      )
    }

    this.gestorTareas?.cancelarTodas()
    const metadata = this.almacen.crear({
      modelo: this.modeloActivo,
      agente: this.agenteActivo,
    })
    this.sesion = metadata
    this.mensajesHistorial = []
    this.ultimoTokens = undefined
    this.tokensAcumulados = 0
    this.ultimaCompactacion = undefined
    this.ultimaEtapaContexto = undefined
    this.ultimosTokensRecuperados = undefined
    this.metricas = this.calcularMetricas(false)
    this.estado = crearEstadoInicial(
      this.componerPromptEfectivo(this.obtenerDefinicionAgenteActivo()),
      this.modeloActivo,
      this.metricas,
      this.agenteActivo,
      {
        sesionId: metadata.id,
        skills: this.obtenerSkillsVisiblesEstado(),
        skillsOmitidas: this.skillsOmitidas,
      },
    )
    this.agregarAviso(`Sesión nueva: ${metadata.id}`)
    this.notificar()
    return metadata.id
  }

  cambiarSesion(id: string): void {
    if (this.estado.turnoEnCurso) {
      throw new ErrorCambioSesion(
        'No se puede cambiar de sesión mientras hay un turno en curso.',
      )
    }
    if (!this.almacen) {
      throw new ErrorCambioSesion(
        'El guardado de sesiones está desactivado en esta ejecución.',
      )
    }

    const cargada = this.almacen.cargar(id)
    this.adoptarSesion(
      cargada,
      `Sesión reanudada: ${id} (${cargada.mensajes.length} mensajes).`,
    )
  }

  /** Crea una rama desde el turno indicado de la sesión activa y la adopta. */
  ramificar(desdeTurno: number): string {
    if (this.estado.turnoEnCurso) {
      throw new ErrorCambioSesion(
        'No se puede ramificar mientras hay un turno en curso.',
      )
    }
    if (!this.almacen || !this.sesion) {
      throw new ErrorCambioSesion(
        'El guardado de sesiones está desactivado en esta ejecución.',
      )
    }

    const rama = this.almacen.ramificar(this.sesion.id, desdeTurno)
    this.adoptarSesion(
      rama,
      `Rama creada: ${rama.metadata.id} desde el turno ${desdeTurno} (${rama.mensajes.length} mensajes).`,
    )
    return rama.metadata.id
  }

  buscarSesiones(texto: string): ResultadoBusquedaSesion[] {
    return this.almacen?.buscar(texto) ?? []
  }

  private adoptarSesion(cargada: SesionCargada, aviso: string): void {
    this.gestorTareas?.cancelarTodas()
    this.sesion = cargada.metadata
    this.mensajesHistorial = [...cargada.mensajes]
    if (cargada.metadata.modelo) {
      try {
        this.aplicarModelo(cargada.metadata.modelo)
      } catch {
        // El historial se conserva; el modelo guardado ya no está disponible.
      }
    }

    const guardado = this.agentes.find(
      (a) => a.nombre === cargada.metadata.agente,
    )
    if (guardado && esAgentePrimario(guardado)) {
      this.agenteActivo = guardado.nombre
      this.gestorPermisos.establecerReglasAgente(guardado.permisos ?? [])
    }

    this.recalcularAnunciosSkills()
    this.ultimoTokens = undefined
    this.tokensAcumulados = 0
    this.ultimaCompactacion = undefined
    this.ultimaEtapaContexto = undefined
    this.ultimosTokensRecuperados = undefined
    this.metricas = this.calcularMetricas(false)
    this.estado = crearEstadoInicial(
      this.componerPromptEfectivo(this.obtenerDefinicionAgenteActivo()),
      this.modeloActivo,
      this.metricas,
      this.agenteActivo,
      {
        historial: convertirMensajesAHistorial(this.mensajesHistorial),
        sesionId: cargada.metadata.id,
        skills: this.obtenerSkillsVisiblesEstado(),
        skillsOmitidas: this.skillsOmitidas,
      },
    )
    this.agregarAviso(aviso)
    this.notificar()
  }

  cancelar(): void {
    this.cancelacionSolicitada = true
    if (this.controllerActivo) {
      this.controllerActivo.abort()
    }
    this.gestorTareas?.cancelarTodas()
  }
}

export function detectarTerminalInteractiva(
  stream: { isTTY?: boolean } = process.stdout,
): boolean {
  return Boolean(stream.isTTY)
}
