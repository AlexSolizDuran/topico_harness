import type { ConteoTokens, EventoProveedor } from '../types.js'
import { obtenerCredencial, sanitizarTexto } from './credentials.js'
import { ejecutarConReintentos, type OpcionesReintento } from './retry.js'
import {
  ErrorProveedor,
  type PeticionProveedor,
  type Proveedor,
} from './types.js'

export interface SimulacionRespuesta {
  fragmentosTexto?: string[] | undefined
  llamadasHerramienta?:
    | Array<{
        id: string
        nombre: string
        argumentos: Record<string, unknown>
      }>
    | undefined
  tokens?: ConteoTokens | undefined
  interrumpido?: boolean | undefined
  motivoInterrupcion?: string | undefined
  fallo?:
    | {
        codigoEstado: number
        mensaje: string
        esTransitorio?: boolean | undefined
      }
    | undefined
}

export interface ConfiguracionMock {
  nombre?: string | undefined
  modelo?: string | undefined
  variableEntornoApiKey?: string | undefined
  entorno?: NodeJS.ProcessEnv | undefined
  respuestas?: SimulacionRespuesta[] | undefined
  opcionesReintento?: OpcionesReintento | undefined
}

/**
 * Proveedor configurable para pruebas unitarias y verificación de contratos normativos.
 */
export class ProveedorSimulado implements Proveedor {
  readonly nombre: string
  readonly modelo?: string | undefined
  private readonly variableApiKey?: string | undefined
  private readonly entorno: NodeJS.ProcessEnv
  private readonly respuestas: SimulacionRespuesta[]
  private readonly opcionesReintento: OpcionesReintento
  private indiceRespuesta = 0
  public peticionesRecibidas: PeticionProveedor[] = []

  constructor(config: ConfiguracionMock = {}) {
    this.nombre = config.nombre ?? 'simulado'
    this.modelo = config.modelo
    this.variableApiKey = config.variableEntornoApiKey
    this.entorno = config.entorno ?? process.env
    this.respuestas = [...(config.respuestas ?? [])]
    this.opcionesReintento = config.opcionesReintento ?? {
      esperaInicialMs: 1,
      dormir: () => Promise.resolve(),
    }
  }

  private validarCredencial(): string {
    if (!this.variableApiKey) return ''
    return obtenerCredencial(this.variableApiKey, this.entorno)
  }

  private async procesarFalloSimulado(
    fallo: NonNullable<SimulacionRespuesta['fallo']>,
    clave: string,
  ): Promise<void> {
    try {
      await ejecutarConReintentos(async () => {
        throw new ErrorProveedor(fallo.mensaje, {
          codigoEstado: fallo.codigoEstado,
          esTransitorio: fallo.esTransitorio,
        })
      }, this.opcionesReintento)
    } catch (error) {
      const errOriginal = error instanceof Error ? error.message : String(error)
      const mensajeSanitizado = clave
        ? sanitizarTexto(errOriginal, [clave])
        : errOriginal

      throw new ErrorProveedor(mensajeSanitizado, {
        codigoEstado: fallo.codigoEstado,
        esTransitorio: fallo.esTransitorio,
      })
    }
  }

  private *emitirEventos(
    config: SimulacionRespuesta,
  ): Generator<EventoProveedor, void, unknown> {
    if (config.fragmentosTexto) {
      for (const delta of config.fragmentosTexto) {
        yield { tipo: 'texto', delta }
      }
    }

    if (config.llamadasHerramienta) {
      for (const llamada of config.llamadasHerramienta) {
        yield {
          tipo: 'solicitud_herramienta',
          id: llamada.id,
          nombre: llamada.nombre,
          argumentos: llamada.argumentos,
        }
      }
    }

    if (config.interrumpido) {
      yield {
        tipo: 'fin',
        razon: 'interrumpido',
        motivo: config.motivoInterrupcion ?? 'limite_alcanzado',
        tokens: config.tokens,
      }
    } else {
      yield {
        tipo: 'fin',
        razon: 'completado',
        tokens: config.tokens,
      }
    }
  }

  async *enviar(
    peticion: PeticionProveedor,
  ): AsyncGenerator<EventoProveedor, void, unknown> {
    const clave = this.validarCredencial()
    this.peticionesRecibidas.push(peticion)

    const turno = this.respuestas[this.indiceRespuesta++] ?? {
      fragmentosTexto: ['Respuesta por defecto'],
    }

    if (turno.fallo) {
      await this.procesarFalloSimulado(turno.fallo, clave)
    }

    yield* this.emitirEventos(turno)
  }
}
