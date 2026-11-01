/**
 * Detector de bucles por repetición idéntica consecutiva dentro de un turno.
 */

function ordenarValor(valor: unknown): unknown {
  if (Array.isArray(valor)) {
    return valor.map(ordenarValor)
  }
  if (typeof valor === 'object' && valor !== null) {
    const obj = valor as Record<string, unknown>
    const ordenado: Record<string, unknown> = {}
    const claves = Object.keys(obj).sort()
    for (const clave of claves) {
      if (obj[clave] !== undefined) {
        ordenado[clave] = ordenarValor(obj[clave])
      }
    }
    return ordenado
  }
  return valor
}

/**
 * Serializa los argumentos de forma canónica, ignorando el orden de las claves
 * pero preservando el contenido de los valores.
 */
export function canonicalizarArgumentos(argsRaw: unknown): string {
  let objeto: unknown = argsRaw
  if (typeof argsRaw === 'string') {
    try {
      objeto = JSON.parse(argsRaw)
    } catch {
      objeto = argsRaw
    }
  }
  return JSON.stringify(ordenarValor(objeto ?? {}))
}

export interface EvaluacionRacha {
  bloqueada: boolean
  conteo: number
  mensaje?: string | undefined
  esRepeticion: boolean
  firmaDenegada: boolean
  firma: string
}

export const LIMITE_RACHA_IDENTICA = 3

export class DetectorLoops {
  private ultimaHerramienta?: string | undefined
  private ultimosArgumentos?: string | undefined
  private conteo = 0
  private firmasDenegadas = new Set<string>()

  registrar(nombre: string, argumentos: unknown): EvaluacionRacha {
    const canonicos = canonicalizarArgumentos(argumentos)
    const firma = `${nombre}:${canonicos}`

    if (this.firmasDenegadas.has(firma)) {
      return {
        bloqueada: true,
        conteo: this.conteo,
        mensaje: `ERROR: La llamada a '${nombre}' con estos argumentos fue denegada previamente por repetición.\nLa operación no se completó.`,
        esRepeticion: true,
        firmaDenegada: true,
        firma,
      }
    }

    if (
      this.ultimaHerramienta === nombre &&
      this.ultimosArgumentos === canonicos
    ) {
      this.conteo += 1
    } else {
      this.ultimaHerramienta = nombre
      this.ultimosArgumentos = canonicos
      this.conteo = 1
    }

    const esRepeticion = this.conteo >= LIMITE_RACHA_IDENTICA

    return {
      bloqueada: false,
      conteo: this.conteo,
      esRepeticion,
      firmaDenegada: false,
      firma,
    }
  }

  marcarFirmaDenegada(firma: string): void {
    this.firmasDenegadas.add(firma)
  }

  estaFirmaDenegada(firma: string): boolean {
    return this.firmasDenegadas.has(firma)
  }

  reiniciar(): void {
    this.ultimaHerramienta = undefined
    this.ultimosArgumentos = undefined
    this.conteo = 0
  }
}
