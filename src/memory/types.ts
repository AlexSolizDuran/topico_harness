export interface EntradaMemoria {
  id: string
  titulo: string
  contenido: string
  origen?: string | undefined
  fecha?: string | undefined
  obsoleta?: boolean | undefined
  superadaPor?: string | undefined
  esPreferenciaUsuario?: boolean | undefined
  rutaDetalle?: string | undefined
}

export interface OpcionesMemoria {
  directorioProyecto: string
  directorioUsuario?: string | undefined
  topeArchivoBytes?: number | undefined
  topeTotalBytes?: number | undefined
}

export class ErrorTopeMemoria extends Error {
  constructor(
    public readonly archivo: string,
    public readonly tamanio: number,
    public readonly tope: number,
  ) {
    super(
      `El archivo de memoria '${archivo}' de ${tamanio} bytes supera el tope configurado de ${tope} bytes. La operación no se completó.`,
    )
    this.name = 'ErrorTopeMemoria'
  }
}
