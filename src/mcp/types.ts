import type { z } from 'zod'

export interface ConfiguracionServidorMcp {
  id: string
  comando: string
  args?: string[] | undefined
  env?: Record<string, string> | undefined
}

export interface HerramientaMcp {
  nombre: string
  nombreCompleto: string
  servidor: string
  descripcion: string
  esquema: z.ZodTypeAny
  esquemaJson?: Record<string, unknown> | undefined
  riesgoso?: boolean | undefined
  motivoRiesgo?: string | undefined
}

export interface InformacionAislamientoMcp {
  aislado: boolean
  mecanismo?: string | undefined
  motivoDegradacion?: string | undefined
}

export interface RespuestaMcp {
  resultado?: string | undefined
  error?: string | undefined
  aislamiento?: InformacionAislamientoMcp | undefined
}
