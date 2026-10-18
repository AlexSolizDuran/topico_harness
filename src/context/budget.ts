export const VENTANA_CONTEXTO_DEFECTO = 128000
export const PORCENTAJE_PRESUPUESTO_DEFECTO = 0.8 // 80%

export class ErrorPresupuestoExcedido extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorPresupuestoExcedido'
  }
}

export interface OpcionesPresupuesto {
  ventanaContexto?: number | undefined
  porcentajeLimite?: number | undefined
}

/**
 * Controla el presupuesto de tokens asignado al turno, asegurando que se reserve
 * un margen conservador inalterable (20% por defecto) y previniendo el envío si se supera el límite.
 */
export class PresupuestoContexto {
  readonly ventanaContexto: number
  readonly porcentajeLimite: number
  readonly limitePresupuesto: number
  readonly margenConservado: number

  constructor(opciones: OpcionesPresupuesto = {}) {
    this.ventanaContexto = opciones.ventanaContexto ?? VENTANA_CONTEXTO_DEFECTO
    this.porcentajeLimite =
      opciones.porcentajeLimite ?? PORCENTAJE_PRESUPUESTO_DEFECTO
    this.limitePresupuesto = Math.floor(
      this.ventanaContexto * this.porcentajeLimite,
    )
    this.margenConservado = this.ventanaContexto - this.limitePresupuesto
  }

  haAlcanzadoLimite(tokens: number): boolean {
    return tokens >= this.limitePresupuesto
  }

  estaCercaDelLimite(tokens: number, umbralCercania = 0.85): boolean {
    return tokens >= this.limitePresupuesto * umbralCercania
  }

  validarEnvio(tokens: number): void {
    if (tokens > this.limitePresupuesto) {
      throw new ErrorPresupuestoExcedido(
        `Se superó el presupuesto de tokens permitido (${tokens} > ${this.limitePresupuesto}). La petición fue bloqueada para conservar el margen del modelo.`,
      )
    }
  }
}
