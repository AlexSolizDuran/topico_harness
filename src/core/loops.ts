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
}

export const LIMITE_RACHA_IDENTICA = 3

export class DetectorLoops {
  private ultimaHerramienta?: string | undefined
  private ultimosArgumentos?: string | undefined
  private conteo = 0

  registrar(nombre: string, argumentos: unknown): EvaluacionRacha {
    const canonicos = canonicalizarArgumentos(argumentos)

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

    if (this.conteo >= LIMITE_RACHA_IDENTICA) {
      return {
        bloqueada: true,
        conteo: this.conteo,
        mensaje: `ERROR: llamaste a ${nombre} con los mismos argumentos ${this.conteo} veces seguidas.\nEl resultado anterior no cambió. Cambiá de estrategia o respondé con lo que ya tenés.`,
      }
    }

    return {
      bloqueada: false,
      conteo: this.conteo,
    }
  }

  reiniciar(): void {
    this.ultimaHerramienta = undefined
    this.ultimosArgumentos = undefined
    this.conteo = 0
  }
}
