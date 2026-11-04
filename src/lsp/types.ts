export interface ConfiguracionServidorLsp {
  lenguaje: string
  extensiones?: string[] | undefined
  comando: string
  args?: string[] | undefined
  raiz: string
}

export type OperacionLsp =
  | 'definition'
  | 'references'
  | 'documentSymbols'
  | 'workspaceSymbols'
  | 'hover'
  | 'diagnostics'

export interface PosicionLsp {
  linea: number
  caracter: number
}

export interface DiagnosticoLsp {
  mensaje: string
  gravedad?: 'error' | 'warning' | 'info' | 'hint' | undefined
  linea: number
  caracter: number
}

export interface SimboloLsp {
  nombre: string
  tipo: string
  archivo: string
  linea: number
  caracter: number
}

export interface ArgumentosHerramientaLsp {
  operacion: OperacionLsp
  ruta?: string | undefined
  linea?: number | undefined
  caracter?: number | undefined
  simbolo?: string | undefined
}

