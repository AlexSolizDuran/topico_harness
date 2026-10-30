/**
 * Tipos compartidos que cruzan dos o más módulos del harness.
 * Se centralizan aquí para evitar dependencias circulares entre capacidades.
 */

export type RolMensaje = 'user' | 'assistant' | 'tool' | 'system'

export type AccionPermisoCanon =
  | 'read'
  | 'glob'
  | 'grep'
  | 'edit'
  | 'shell'
  | 'shell_compuesto'
  | 'shell_redireccion'
  | 'subagent'
  | 'external_directory'
  | 'skill'
  | 'hook'

export type AccionPermiso =
  | AccionPermisoCanon
  | 'leer'
  | 'buscar_archivos'
  | 'buscar archivos'
  | 'buscar_texto'
  | 'buscar texto'
  | 'editar'
  | 'ejecutar'
  | 'comando_compuesto'
  | 'comando compuesto'
  | 'redireccion'
  | 'redirección'
  | 'comando_redirigido'
  | 'delegar'
  | 'directorio_externo'
  | 'directorio externo'
  | '*'

export type EfectoPermiso = 'permitir' | 'consultar' | 'denegar'

export interface ReglaPermiso {
  accion: AccionPermiso
  recurso: string
  efecto: EfectoPermiso
}

export type DecisionAprobacion = 'una_vez' | 'siempre' | 'denegar'

export interface SolicitudAprobacion {
  id: string
  herramienta: string
  accion: AccionPermisoCanon
  recurso: string
  patronSugerido: string
  obligatoria: boolean
  motivo?: string | undefined
}

export interface EvaluacionPermiso {
  efecto: EfectoPermiso
  accion: AccionPermisoCanon
  recurso: string
  patronSugerido: string
  obligatoria: boolean
  motivo?: string | undefined
}

export interface PorteroPermisos {
  evaluar: (
    herramienta: {
      nombre: string
      accionPermiso?: AccionPermiso | undefined
      resolverAccion?:
        | ((args: Record<string, unknown>) => AccionPermiso)
        | undefined
      obtenerRecurso?:
        | ((args: Record<string, unknown>) => string | string[])
        | undefined
      proponerPatron?:
        | ((args: Record<string, unknown>, recurso: string) => string)
        | undefined
      motivoAprobacionObligatoria?:
        | ((args: Record<string, unknown>) => string | undefined)
        | undefined
    },
    argumentos: Record<string, unknown>,
  ) => EvaluacionPermiso
  solicitarAprobacion?:
    | ((
        solicitud: SolicitudAprobacion,
        senalCancelacion?: AbortSignal,
      ) => Promise<DecisionAprobacion>)
    | undefined
}

export interface SolicitudHerramienta {
  id: string
  nombre: string
  argumentos: Record<string, unknown>
}

export interface Mensaje {
  rol: RolMensaje
  contenido?: string | undefined
  llamadasHerramientas?: SolicitudHerramienta[] | undefined
  idLlamada?: string | undefined
  resultado?: string | undefined
}

export interface ConteoTokens {
  entrada: number
  salida: number
}

export type EventoProveedor =
  | {
      tipo: 'texto'
      delta: string
    }
  | {
      tipo: 'solicitud_herramienta'
      id: string
      nombre: string
      argumentos: Record<string, unknown>
    }
  | {
      tipo: 'fin'
      razon: 'completado' | 'interrumpido'
      motivo?: string | undefined
      tokens?: ConteoTokens | undefined
    }

export type EventoHook =
  | 'sessionStart'
  | 'sessionEnd'
  | 'preTool'
  | 'postTool'
  | 'turnEnd'

export interface ContextoHook {
  evento: EventoHook
  herramienta?: string | undefined
  argumentos?: Record<string, unknown> | undefined
  resultado?: string | undefined
}

export interface ResultadoEjecucionHook {
  bloqueado: boolean
  mensajeBloqueo?: string | undefined
  notas: string[]
  avisos: string[]
}

export interface EjecutorHooks {
  ejecutar: (
    contexto: ContextoHook,
    senalCancelacion?: AbortSignal,
  ) => Promise<ResultadoEjecucionHook>
}

export type EventoTurno =
  | {
      tipo: 'texto'
      delta: string
    }
  | {
      tipo: 'paso_inicio'
      paso: number
    }
  | {
      tipo: 'herramienta_inicio'
      id: string
      nombre: string
      argumentos: Record<string, unknown>
    }
  | {
      tipo: 'herramienta_fin'
      id: string
      nombre: string
      resultado: string
      esError: boolean
    }
  | {
      tipo: 'espera_aprobacion'
      solicitud: SolicitudAprobacion
    }
  | {
      tipo: 'fin_espera_aprobacion'
      id: string
      decision: DecisionAprobacion
    }
  | {
      tipo: 'limite_pasos_alcanzado'
      pasos: number
    }
  | {
      tipo: 'instrucciones_cargadas'
      ruta: string
      tamanioBytes: number
      tokens: number
    }
  | {
      tipo: 'aviso_hook'
      texto: string
    }

export type EstadoTurno =
  | {
      tipo: 'completado'
      mensajes: Mensaje[]
      pasosEjecutados: number
      tokens?: ConteoTokens | undefined
    }
  | {
      tipo: 'cancelado'
      mensajes: Mensaje[]
      pasosEjecutados: number
      tokens?: ConteoTokens | undefined
    }
  | {
      tipo: 'fallido'
      motivo: string
      mensajes: Mensaje[]
      pasosEjecutados: number
      tokens?: ConteoTokens | undefined
    }
