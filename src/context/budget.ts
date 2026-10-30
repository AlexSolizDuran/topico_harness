export const VENTANA_CONTEXTO_DEFECTO = 128000
export const PORCENTAJE_PRESUPUESTO_DEFECTO = 0.8 // 80%

export type EtapaContexto =
  | 'ninguna'
  | 'aviso'
  | 'enmascarar'
  | 'podar'
  | 'resumir'
  | 'compactar'

export interface UmbralesContexto {
  aviso: number
  enmascarar: number
  podar: number
  resumir: number
  compactar: number
}

export interface ConfiguracionUmbralesContexto {
  aviso?: number | undefined
  enmascarar?: number | undefined
  recorte?: number | undefined
  podar?: number | undefined
  poda?: number | undefined
  resumir?: number | undefined
  resumen?: number | undefined
  compactar?: number | undefined
  compactacion?: number | undefined
}

export const UMBRALES_POR_DEFECTO: Readonly<UmbralesContexto> = {
  aviso: 0.7,
  enmascarar: 0.8,
  podar: 0.85,
  resumir: 0.9,
  compactar: 0.99,
}

export class ErrorPresupuestoExcedido extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorPresupuestoExcedido'
  }
}

export class ErrorConfiguracionUmbrales extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorConfiguracionUmbrales'
  }
}

export interface OpcionesPresupuesto {
  ventanaContexto?: number | undefined
  porcentajeLimite?: number | undefined
  umbrales?: ConfiguracionUmbralesContexto | undefined
}

function normalizarFraccion(valor: number, nombre: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor <= 0) {
    throw new ErrorConfiguracionUmbrales(
      `El umbral '${nombre}' (${String(valor)}) no es un número positivo válido.`,
    )
  }
  const fraccion = valor > 1 ? valor / 100 : valor
  if (fraccion <= 0 || fraccion > 1) {
    throw new ErrorConfiguracionUmbrales(
      `El umbral '${nombre}' (${valor}) debe estar entre 0 y 100%.`,
    )
  }
  return Number(fraccion.toFixed(6))
}

export function resolverYValidarUmbrales(
  config?: ConfiguracionUmbralesContexto | undefined,
): UmbralesContexto {
  if (!config) {
    return { ...UMBRALES_POR_DEFECTO }
  }

  const aviso =
    config.aviso !== undefined
      ? normalizarFraccion(config.aviso, 'aviso')
      : UMBRALES_POR_DEFECTO.aviso
  const rawEnmascarar = config.enmascarar ?? config.recorte
  const enmascarar =
    rawEnmascarar !== undefined
      ? normalizarFraccion(rawEnmascarar, 'enmascarar')
      : UMBRALES_POR_DEFECTO.enmascarar
  const rawPodar = config.podar ?? config.poda
  const podar =
    rawPodar !== undefined
      ? normalizarFraccion(rawPodar, 'podar')
      : UMBRALES_POR_DEFECTO.podar
  const rawResumir = config.resumir ?? config.resumen
  const resumir =
    rawResumir !== undefined
      ? normalizarFraccion(rawResumir, 'resumir')
      : UMBRALES_POR_DEFECTO.resumir
  const rawCompactar = config.compactar ?? config.compactacion
  const compactar =
    rawCompactar !== undefined
      ? normalizarFraccion(rawCompactar, 'compactar')
      : UMBRALES_POR_DEFECTO.compactar

  const pares: Array<[string, number]> = [
    ['aviso', aviso],
    ['enmascarar', enmascarar],
    ['podar', podar],
    ['resumir', resumir],
    ['compactar', compactar],
  ]

  for (let i = 0; i < pares.length - 1; i++) {
    const actual = pares[i]
    const siguiente = pares[i + 1]
    if (!actual || !siguiente) continue
    if (actual[1] >= siguiente[1]) {
      const resumenUmbrales = pares
        .map(([nombre, val]) => `${nombre}=${Math.round(val * 100)}%`)
        .join(', ')
      throw new ErrorConfiguracionUmbrales(
        `Los umbrales de contexto deben ser estrictamente crecientes (${resumenUmbrales}): '${actual[0]}' (${Math.round(actual[1] * 100)}%) no es menor que '${siguiente[0]}' (${Math.round(siguiente[1] * 100)}%).`,
      )
    }
  }

  return { aviso, enmascarar, podar, resumir, compactar }
}

/**
 * Controla el presupuesto de tokens asignado al turno, asegurando que se reserve
 * un margen conservador inalterable (20% por defecto), evaluando etapas progresivas
 * (70/80/85/90/99%) y previniendo el envío si se supera el límite duro.
 */
export class PresupuestoContexto {
  readonly ventanaContexto: number
  readonly porcentajeLimite: number
  readonly limitePresupuesto: number
  readonly margenConservado: number
  readonly umbrales: UmbralesContexto

  constructor(opciones: OpcionesPresupuesto = {}) {
    this.ventanaContexto = opciones.ventanaContexto ?? VENTANA_CONTEXTO_DEFECTO
    this.porcentajeLimite =
      opciones.porcentajeLimite ?? PORCENTAJE_PRESUPUESTO_DEFECTO
    this.limitePresupuesto = Math.floor(
      this.ventanaContexto * this.porcentajeLimite,
    )
    this.margenConservado = this.ventanaContexto - this.limitePresupuesto
    this.umbrales = resolverYValidarUmbrales(opciones.umbrales)
  }

  haAlcanzadoLimite(tokens: number): boolean {
    return tokens >= this.limitePresupuesto
  }

  estaCercaDelLimite(
    tokens: number,
    umbralCercania = this.umbrales.enmascarar,
  ): boolean {
    return tokens >= this.limitePresupuesto * umbralCercania
  }

  alcanzaUmbral(
    primero: number | Exclude<EtapaContexto, 'ninguna'>,
    segundo: number | Exclude<EtapaContexto, 'ninguna'>,
  ): boolean {
    const tokens = typeof primero === 'number' ? primero : (segundo as number)
    const etapa = (typeof primero === 'string' ? primero : segundo) as Exclude<
      EtapaContexto,
      'ninguna'
    >
    return tokens >= this.limitePresupuesto * this.umbrales[etapa]
  }

  evaluarEtapa(tokens: number): EtapaContexto {
    if (this.alcanzaUmbral(tokens, 'compactar')) return 'compactar'
    if (this.alcanzaUmbral(tokens, 'resumir')) return 'resumir'
    if (this.alcanzaUmbral(tokens, 'podar')) return 'podar'
    if (this.alcanzaUmbral(tokens, 'enmascarar')) return 'enmascarar'
    if (this.alcanzaUmbral(tokens, 'aviso')) return 'aviso'
    return 'ninguna'
  }

  porcentajeSobreLimite(tokens: number): number {
    if (this.limitePresupuesto <= 0) return 0
    return Math.round((tokens / this.limitePresupuesto) * 100)
  }

  validarEnvio(tokens: number): void {
    if (tokens > this.limitePresupuesto) {
      throw new ErrorPresupuestoExcedido(
        `Se superó el presupuesto de tokens permitido (${tokens} > ${this.limitePresupuesto}). La petición fue bloqueada para conservar el margen del modelo.`,
      )
    }
  }
}
