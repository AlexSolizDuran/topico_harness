/**
 * Tipos compartidos que cruzan dos o más módulos del harness.
 * Se centralizan aquí para evitar dependencias circulares entre capacidades.
 */

export type RolMensaje = 'user' | 'assistant' | 'tool' | 'system'

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
      tipo: 'limite_pasos_alcanzado'
      pasos: number
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
