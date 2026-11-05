import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, resolve } from 'node:path'
import { cargarAgentes } from './agents/cargar.js'
import {
  type DefinicionAgente,
  validarConjuntoAgentes,
} from './agents/definiciones.js'
import {
  type ConfiguracionUmbralesContexto,
  resolverYValidarUmbrales,
} from './context/budget.js'
import { estimarTokensTexto } from './context/tokens.js'
import { RegistroHerramientas } from './core/registry.js'
import {
  type ConfiguracionHooks,
  type EjecutorComandoHook,
  ErrorBloqueoHook,
  GestorHooks,
} from './hooks/ejecutar.js'
import { GestorInstrucciones } from './instructions/cargar-instrucciones.js'
import { type FabricaProveedor, SesionInteractiva } from './interface/runner.js'
import type { EstadoSesionVisual } from './interface/state.js'
import {
  crearHerramientaLsp,
  decorarHerramientasConDiagnosticos,
  GestorLsp,
} from './lsp/index.js'
import { crearEntradaHerramientaMcp, GestorMcp } from './mcp/index.js'
import {
  AlmacenMemoria,
  extraerHechosDeSesion,
  formatearBloqueMemoria,
  resolverContradicciones,
} from './memory/index.js'
import {
  GestorPermisos,
  type ManejadorAprobacionCliente,
} from './permissions/portero.js'
import {
  type ConfiguracionHarness,
  cargarConfig,
  listarModelos,
} from './provider/config.js'
import { sanitizarTexto } from './provider/credentials.js'
import { resolverProveedor } from './provider/factory.js'
import type { Proveedor } from './provider/types.js'
import { EjecutorSandbox } from './sandbox/index.js'
import {
  AlmacenSesiones,
  ErrorSesion,
  type SesionCargada,
} from './sesiones/index.js'
import { descubrirSkills } from './skills/index.js'
import { GestorTareasBackground } from './subagents/background.js'
import { crearHerramientaDelegacion } from './subagents/herramienta.js'
import {
  crearHerramientaCancelarTarea,
  crearHerramientaEstadoTareas,
} from './subagents/herramientas-background.js'
import {
  crearCatalogoPorDefecto,
  registrarHerramientaConValidacion,
} from './tools/catalog.js'
import type { PorteroPermisos, ReglaPermiso } from './types.js'

export interface OpcionesHarness {
  directorioProyecto?: string | undefined
  proveedor?: Proveedor | undefined
  registro?: RegistroHerramientas | undefined
  config?: ConfiguracionHarness | undefined
  promptSistema?: string | undefined
  ventanaContexto?: number | undefined
  umbralesContexto?: ConfiguracionUmbralesContexto | undefined
  credencialesSanitizar?: string[] | undefined
  modelosDisponibles?: string[] | undefined
  modeloActivo?: string | undefined
  fabricaProveedor?: FabricaProveedor | undefined
  alActualizar?: ((estado: EstadoSesionVisual) => void) | undefined
  agentes?: DefinicionAgente[] | undefined
  agenteActivo?: string | undefined
  esInteractivo?: boolean | undefined
  reglasPermiso?: ReglaPermiso[] | undefined
  portero?: PorteroPermisos | undefined
  manejadorAprobacion?: ManejadorAprobacionCliente | undefined
  guardarSesiones?: boolean | undefined
  sesionId?: string | undefined
  continuar?: boolean | undefined
  almacen?: AlmacenSesiones | undefined
  ramaDe?: string | undefined
  desde?: number | undefined
  topeInstruccionesBytes?: number | undefined
  topeTotalInstruccionesBytes?: number | undefined
  topeSkillBytes?: number | undefined
  hooks?: ConfiguracionHooks | undefined
  timeoutHookMs?: number | undefined
  ejecutorComandoHook?: EjecutorComandoHook | undefined
}

export interface HarnessConstruido {
  sesion: SesionInteractiva
  registro: RegistroHerramientas
  proveedor: Proveedor
  agentes: DefinicionAgente[]
  config?: ConfiguracionHarness | undefined
  cerrar: () => Promise<void>
}

const PROMPT_SISTEMA_POR_DEFECTO =
  'Sos un agente de programación que trabaja sobre el proyecto actual. Usá las herramientas para leer, buscar, editar y verificar antes de responder. Si una herramienta devuelve un error, leelo y corregí el rumbo. Respondé en el idioma del usuario.'

/**
 * Ensambla catálogo, provider, agentes, permisos y sesión en un solo lugar,
 * para poder probar el cableado sin spawnear un proceso.
 */
export function construirHarness(
  opciones: OpcionesHarness = {},
): HarnessConstruido {
  const directorioProyecto = opciones.directorioProyecto ?? process.cwd()
  const gestorInstrucciones = new GestorInstrucciones({
    directorioProyecto,
    topeArchivoBytes: opciones.topeInstruccionesBytes,
    topeTotalBytes: opciones.topeTotalInstruccionesBytes,
  })
  const instruccionesContenido = gestorInstrucciones.obtenerContenido()
  const {
    skills,
    avisos: avisosSkills,
    omitidas: skillsOmitidas,
  } = descubrirSkills(directorioProyecto, {
    topeBytes: opciones.topeSkillBytes,
  })

  let sesionRef: SesionInteractiva | undefined
  let config = opciones.config
  if (!config && !opciones.proveedor) {
    config = cargarConfig({ directorioProyecto })
  }

  let credencialesSanitizar = opciones.credencialesSanitizar ?? []

  const ejecutorSandbox = new EjecutorSandbox()
  const ejecutorShell = async (comando: string, cwd: string) => {
    const esWindows = process.platform === 'win32'
    const resultado = await ejecutorSandbox.ejecutarComando({
      directorioProyecto: cwd,
      comando: esWindows ? 'powershell.exe' : 'sh',
      args: esWindows
        ? ['-NoProfile', '-NonInteractive', '-Command', comando]
        : ['-c', comando],
      config: config?.sandbox,
    })
    return {
      salida: `${resultado.stdout}${resultado.stderr}`,
      codigoSalida: resultado.codigoSalida,
      aislamiento: resultado.aislamiento,
    }
  }

  const gestorLsp = new GestorLsp({
    servidores: (config?.lsp ?? []).map((servidor) => ({
      ...servidor,
      raiz: isAbsolute(servidor.raiz)
        ? servidor.raiz
        : resolve(directorioProyecto, servidor.raiz),
    })),
  })

  const gestorMcp = new GestorMcp({
    servidores: config?.mcp,
    sanitizarCredenciales: (texto) =>
      sanitizarTexto(texto, credencialesSanitizar),
  })

  const almacenMemoria = new AlmacenMemoria(directorioProyecto)
  const almacenMemoriaUsuario = config?.memoria?.usuario
    ? new AlmacenMemoria(directorioProyecto, {
        directorioBase:
          config.memoria.rutaUsuario ??
          resolve(homedir(), '.harness', 'memory'),
      })
    : undefined
  const bloqueMemoria = formatearBloqueMemoria({
    memoriaProyecto: almacenMemoria.cargarIndice(),
    memoriaUsuario: almacenMemoriaUsuario?.cargarIndice(),
  })

  const registro =
    opciones.registro ??
    crearCatalogoPorDefecto({
      directorioProyecto,
      skills,
      alCargarSkill: (id) => sesionRef?.marcarSkillCargada(id),
      ejecutorShell,
      alAvisoAislamiento: (aislamiento) => {
        sesionRef?.agregarAvisoVisible(
          `Ejecución sin aislamiento: ${aislamiento.motivoDegradacion ?? 'sin mecanismo disponible'}`,
        )
      },
    })

  if (!opciones.registro) {
    registrarHerramientaConValidacion(
      registro,
      crearHerramientaLsp({
        gestorLsp,
        reglasGlobales: opciones.reglasPermiso,
        directorioProyecto,
      }),
    )
    decorarHerramientasConDiagnosticos(registro, gestorLsp, directorioProyecto)
  }

  let proveedor = opciones.proveedor
  let ventanaContexto = opciones.ventanaContexto ?? 128000
  let modelosDisponibles = opciones.modelosDisponibles ?? []
  let modeloActivo = opciones.modeloActivo ?? ''
  let fabricaProveedor = opciones.fabricaProveedor

  if (!proveedor) {
    const configResuelta = config ?? cargarConfig({ directorioProyecto })
    config = configResuelta
    const resuelto = resolverProveedor({ config: configResuelta })
    proveedor = resuelto.proveedor
    ventanaContexto = resuelto.ventanaContexto
    credencialesSanitizar = resuelto.credencialesSanitizar
    modelosDisponibles = listarModelos(configResuelta)
    modeloActivo = `${resuelto.proveedorId}/${resuelto.modelo.id}`

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

  const umbralesConfig =
    opciones.umbralesContexto ?? config?.umbrales ?? config?.contexto?.umbrales
  if (umbralesConfig) {
    resolverYValidarUmbrales(umbralesConfig)
  }

  if (!modeloActivo && proveedor.modelo) {
    modeloActivo = `${proveedor.nombre}/${proveedor.modelo}`
  }
  if (modelosDisponibles.length === 0 && modeloActivo) {
    modelosDisponibles = [modeloActivo]
  }

  let agentesLista: DefinicionAgente[] = []
  let gestorHooksRef: GestorHooks | undefined
  const gestorTareas = new GestorTareasBackground()

  if (!opciones.registro && !registro.tiene('task')) {
    const toolTask = crearHerramientaDelegacion({
      obtenerAgentes: () => agentesLista,
      obtenerAgenteActivo: () => sesionRef?.obtenerAgenteActivo() ?? 'build',
      obtenerCatalogo: () => registro,
      obtenerProveedorPadre: () => proveedor,
      obtenerVentanaPadre: () => ventanaContexto,
      gestorTareas,
      resolverModelo: (modelo) => {
        if (!fabricaProveedor) {
          return { proveedor, ventanaContexto, credencialesSanitizar }
        }
        const barra = modelo.indexOf('/')
        const provId = barra > 0 ? modelo.slice(0, barra) : proveedor.nombre
        const modId = barra > 0 ? modelo.slice(barra + 1) : modelo
        return fabricaProveedor(provId, modId)
      },
      obtenerPromptBase: () =>
        sesionRef?.obtenerPromptBaseParaSubagente() ??
        opciones.promptSistema ??
        PROMPT_SISTEMA_POR_DEFECTO,
      obtenerCredenciales: () => credencialesSanitizar,
      crearPorteroSubagente: (subagente) =>
        new GestorPermisos({
          directorioProyecto,
          reglasGlobales: opciones.reglasPermiso,
          reglasAgente: subagente.permisos,
          esInteractivo: opciones.esInteractivo ?? true,
          manejadorAprobacion: opciones.manejadorAprobacion,
        }),
      crearHooksSubagente: (_subagente, porteroHijo) =>
        gestorHooksRef?.paraSubagente(porteroHijo),
    })
    registrarHerramientaConValidacion(registro, toolTask)
    registrarHerramientaConValidacion(
      registro,
      crearHerramientaEstadoTareas(gestorTareas),
    )
    registrarHerramientaConValidacion(
      registro,
      crearHerramientaCancelarTarea(gestorTareas),
    )
  }

  const opcionesValidacion = {
    herramientasDisponibles: registro.listarNombres(),
    ...(modelosDisponibles.length > 0 ? { modelosDisponibles } : {}),
    servidoresMcp: (config?.mcp ?? []).map((s) => s.id),
  }

  let agentePorDefecto = 'build'
  if (opciones.agentes) {
    agentesLista = validarConjuntoAgentes(opciones.agentes, opcionesValidacion)
    const primeroPrimario = agentesLista.find(
      (a) => a.modo === 'primario' || a.modo === 'ambos',
    )
    agentePorDefecto = primeroPrimario?.nombre ?? 'build'
  } else {
    const cargados = cargarAgentes({
      ...opcionesValidacion,
      directorioProyecto,
    })
    agentesLista = cargados.agentes
    agentePorDefecto = cargados.agentePorDefecto
  }

  const guardarSesiones =
    opciones.guardarSesiones !== false &&
    config?.sesiones?.guardar !== false &&
    (config !== undefined ||
      opciones.almacen !== undefined ||
      opciones.sesionId !== undefined ||
      opciones.ramaDe !== undefined ||
      opciones.continuar === true)

  if (opciones.ramaDe !== undefined && !guardarSesiones) {
    throw new ErrorSesion(
      'No se puede ramificar con el guardado de sesiones desactivado.',
    )
  }

  let almacen = opciones.almacen
  let sesionInicial: SesionCargada | undefined
  if (guardarSesiones && !almacen) {
    almacen = new AlmacenSesiones({
      directorioProyecto,
      maximo: config?.sesiones?.maximo,
    })
  }
  if (almacen) {
    if (opciones.ramaDe !== undefined) {
      if (
        opciones.desde === undefined ||
        !Number.isInteger(opciones.desde) ||
        opciones.desde < 0
      ) {
        throw new ErrorSesion(
          'La rama requiere --desde con un turno entero mayor o igual que cero.',
        )
      }
      sesionInicial = almacen.ramificar(opciones.ramaDe, opciones.desde)
    } else if (opciones.sesionId) {
      sesionInicial = almacen.cargar(opciones.sesionId)
    } else if (opciones.continuar) {
      const ultima = almacen.ultima(directorioProyecto)
      if (ultima) sesionInicial = almacen.cargar(ultima.id)
    }
  }

  const hooksConfig = opciones.hooks ?? config?.hooks
  const porteroInicial =
    opciones.portero ??
    new GestorPermisos({
      directorioProyecto,
      reglasGlobales: opciones.reglasPermiso,
      esInteractivo: opciones.esInteractivo ?? true,
      manejadorAprobacion: opciones.manejadorAprobacion,
    })

  const avisosIniciales = [...avisosSkills]
  let sessionStartPendiente = false

  const porteroDelegadoHooks: PorteroPermisos = {
    evaluar: (herramienta, argumentos) =>
      (
        opciones.portero ??
        sesionRef?.obtenerGestorPermisos() ??
        porteroInicial
      ).evaluar(herramienta, argumentos),
    solicitarAprobacion: (solicitud, senal) => {
      const activo =
        opciones.portero ?? sesionRef?.obtenerGestorPermisos() ?? porteroInicial
      if (!activo.solicitarAprobacion) {
        return Promise.resolve('denegar')
      }
      return activo.solicitarAprobacion(solicitud, senal)
    },
  }

  if (hooksConfig) {
    gestorHooksRef = new GestorHooks({
      hooks: hooksConfig,
      directorioProyecto,
      portero: porteroDelegadoHooks,
      credenciales: credencialesSanitizar,
      timeoutMs: opciones.timeoutHookMs,
      ejecutorComando: opciones.ejecutorComandoHook,
    })

    const inicioSync = gestorHooksRef.ejecutarSincrono({
      evento: 'sessionStart',
    })
    if (inicioSync.requiereAprobacionAsync) {
      sessionStartPendiente = true
    } else {
      avisosIniciales.push(...inicioSync.resultado.avisos)
      if (inicioSync.resultado.bloqueado) {
        throw new ErrorBloqueoHook(
          'sessionStart',
          inicioSync.resultado.mensajeBloqueo ??
            'El arranque de la sesión fue bloqueado por un hook sessionStart.',
        )
      }
    }
  }

  const sesion = new SesionInteractiva({
    proveedor,
    registro,
    promptSistema: opciones.promptSistema ?? PROMPT_SISTEMA_POR_DEFECTO,
    ventanaContexto,
    umbralesContexto: umbralesConfig,
    credencialesSanitizar,
    modelosDisponibles,
    modeloActivo,
    fabricaProveedor,
    alActualizar: opciones.alActualizar,
    agentes: agentesLista,
    agenteActivo: opciones.agenteActivo ?? agentePorDefecto,
    directorioProyecto,
    esInteractivo: opciones.esInteractivo,
    reglasPermiso: opciones.reglasPermiso,
    portero: opciones.portero,
    manejadorAprobacion: opciones.manejadorAprobacion,
    gestorTareas,
    gestorInstrucciones,
    ...(almacen ? { almacen } : {}),
    ...(sesionInicial ? { sesionInicial } : {}),
    ...(instruccionesContenido
      ? {
          instruccionesProyecto: instruccionesContenido,
          tokensSistemaInstrucciones: estimarTokensTexto(
            instruccionesContenido,
          ),
        }
      : {}),
    ...(bloqueMemoria
      ? {
          memoriaInyectada: bloqueMemoria,
          tokensSistemaMemoria: estimarTokensTexto(bloqueMemoria),
        }
      : {}),
    obtenerRegistroExtra: async (agente, portero) => {
      const declarados = agente.mcp ?? []
      if (declarados.length === 0) return undefined

      const configurados = new Set((config?.mcp ?? []).map((s) => s.id))
      const servidores = declarados.filter((id) => configurados.has(id))
      for (const id of servidores) {
        try {
          await gestorMcp.conectarServidor(id)
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : String(error)
          sesionRef?.agregarAvisoVisible(
            `No se pudo conectar al servidor MCP '${id}': ${mensaje}`,
          )
        }
      }

      const visibles = gestorMcp.obtenerHerramientasVisibles(servidores).filter(
        (herramienta) =>
          portero.evaluar(
            {
              nombre: herramienta.nombreCompleto,
              accionPermiso: 'mcp',
              obtenerRecurso: () =>
                `${herramienta.servidor}/${herramienta.nombre}`,
            },
            {},
          ).efecto !== 'denegar',
      )
      if (visibles.length === 0) return undefined

      const extra = new RegistroHerramientas()
      for (const herramienta of visibles) {
        registrarHerramientaConValidacion(
          extra,
          crearEntradaHerramientaMcp(gestorMcp, herramienta),
        )
      }
      return extra
    },
    skills: skills.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      descripcion: s.descripcion,
      cargada: false,
    })),
    skillsOmitidas: skillsOmitidas.map((o) => ({
      id: o.id,
      motivo: o.motivo,
    })),
    avisosIniciales,
    gestorHooks: gestorHooksRef,
    sessionStartPendiente,
  })
  sesionRef = sesion

  if (
    opciones.agenteActivo &&
    opciones.agenteActivo !== sesion.obtenerAgenteActivo()
  ) {
    sesion.cambiarAgente(opciones.agenteActivo)
  }

  /**
   * Extrae hechos aprendidos al cerrar y los guarda junto al índice existente.
   * Cualquier fallo se informa como aviso: nunca impide cerrar la sesión.
   */
  const extraerMemoriaAlCerrar = async (): Promise<void> => {
    const historial = sesion.obtenerHistorial()
    if (historial.length === 0) return

    const usaMemoria =
      config?.memoria !== undefined ||
      existsSync(almacenMemoria.obtenerDirectorio())
    if (!usaMemoria) return

    let proveedorMemoria = proveedor
    if (config?.memoria?.modelo && fabricaProveedor) {
      const barra = config.memoria.modelo.indexOf('/')
      const proveedorId =
        barra > 0 ? config.memoria.modelo.slice(0, barra) : proveedor.nombre
      const modeloId =
        barra > 0
          ? config.memoria.modelo.slice(barra + 1)
          : config.memoria.modelo
      try {
        proveedorMemoria = fabricaProveedor(proveedorId, modeloId).proveedor
      } catch {
        // Si el modelo declarado no resuelve, se usa el activo.
      }
    }

    const resultado = await extraerHechosDeSesion(historial, {
      proveedor: proveedorMemoria,
      origen: 'sesion',
    })
    if (resultado.error) {
      sesion.agregarAvisoVisible(
        `No se pudo extraer la memoria de la sesión: ${resultado.error}`,
      )
      return
    }
    if (resultado.entradas.length === 0) return

    const combinadas = resolverContradicciones([
      ...almacenMemoria.cargarIndice(),
      ...resultado.entradas,
    ])
    try {
      almacenMemoria.guardarEntradas(combinadas)
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : String(error)
      sesion.agregarAvisoVisible(
        `No se pudo guardar la memoria de la sesión: ${mensaje}`,
      )
    }
  }

  return {
    sesion,
    registro,
    proveedor,
    agentes: agentesLista,
    config,
    cerrar: async () => {
      await sesion.cerrarSesion()
      await extraerMemoriaAlCerrar()
      gestorLsp.cerrar()
      gestorMcp.cerrar()
      ejecutorSandbox.cerrar()
    },
  }
}
