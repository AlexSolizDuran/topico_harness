export interface ConfiguracionSandbox {
  habilitado?: boolean | undefined
  permitirLecturaFuera?: boolean | undefined
  mecanismoForzado?: string | undefined
}

export interface InformacionAislamiento {
  aislado: boolean
  mecanismo?: string | undefined
  motivoDegradacion?: string | undefined
  directorioTemporal?: string | undefined
}

export interface OpcionesEjecucionAislada {
  directorioProyecto: string
  comando: string
  args?: string[] | undefined
  env?: Record<string, string> | undefined
  config?: ConfiguracionSandbox | undefined
}

export interface ResultadoEjecucionAislada {
  codigoSalida: number
  stdout: string
  stderr: string
  aislamiento: InformacionAislamiento
}
