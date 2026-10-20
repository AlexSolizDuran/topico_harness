import type { EventoProveedor, Mensaje } from '../types.js'

export interface DefinicionHerramienta {
  nombre: string
  descripcion: string
  esquema: Record<string, unknown>
}

export interface PeticionProveedor {
  mensajes: Mensaje[]
  herramientas?: DefinicionHerramienta[] | undefined
  sistema?: string | undefined
  limiteTokens?: number | undefined
  senalCancelacion?: AbortSignal | undefined
}

export interface Proveedor {
  readonly nombre: string
  readonly modelo?: string | undefined
  enviar(
    peticion: PeticionProveedor,
  ): AsyncGenerator<EventoProveedor, void, unknown>
}

export class ErrorProveedor extends Error {
  readonly esTransitorio: boolean
  readonly codigoEstado?: number | undefined

  constructor(
    mensaje: string,
    opciones?: {
      esTransitorio?: boolean | undefined
      codigoEstado?: number | undefined
    },
  ) {
    super(mensaje)
    this.name = 'ErrorProveedor'
    this.esTransitorio = opciones?.esTransitorio ?? false
    this.codigoEstado = opciones?.codigoEstado
  }
}

export class ErrorCredencial extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorCredencial'
  }
}
