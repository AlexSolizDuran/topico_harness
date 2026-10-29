import type { DefinicionHerramienta } from '../provider/types.js'
import type { AccionPermiso } from '../types.js'

export interface EntradaHerramienta {
  nombre: string
  descripcion: string
  esquema: Record<string, unknown>
  accionPermiso?: AccionPermiso | undefined
  resolverAccion?:
    | ((argumentos: Record<string, unknown>) => AccionPermiso)
    | undefined
  obtenerRecurso?:
    | ((argumentos: Record<string, unknown>) => string | string[])
    | undefined
  proponerPatron?:
    | ((argumentos: Record<string, unknown>, recurso: string) => string)
    | undefined
  motivoAprobacionObligatoria?:
    | ((argumentos: Record<string, unknown>) => string | undefined)
    | undefined
  admiteParalelo?: boolean | undefined
  rutasExploradas?:
    | ((argumentos: Record<string, unknown>) => string[] | undefined)
    | undefined
  ejecutar: (
    argumentos: Record<string, unknown>,
    senalCancelacion?: AbortSignal,
  ) => Promise<string>
}

/**
 * Registro de herramientas basado en datos. Permite asociar nombres con esquemas
 * y ejecutores sin recurrir a estructuras condicionales (switch / if).
 */
export class RegistroHerramientas {
  private herramientas = new Map<string, EntradaHerramienta>()

  registrar(herramienta: EntradaHerramienta): void {
    this.herramientas.set(herramienta.nombre, herramienta)
  }

  obtener(nombre: string): EntradaHerramienta | undefined {
    return this.herramientas.get(nombre)
  }

  tiene(nombre: string): boolean {
    return this.herramientas.has(nombre)
  }

  listarNombres(): string[] {
    return Array.from(this.herramientas.keys())
  }

  listarEntradas(): EntradaHerramienta[] {
    return Array.from(this.herramientas.values())
  }

  listarDefiniciones(): DefinicionHerramienta[] {
    return Array.from(this.herramientas.values()).map((h) => ({
      nombre: h.nombre,
      descripcion: h.descripcion,
      esquema: h.esquema,
    }))
  }

  /**
   * Devuelve un nuevo registro con solo las herramientas indicadas,
   * sin mutar el catálogo original.
   */
  filtrar(nombres: Iterable<string>): RegistroHerramientas {
    const permitido = new Set(nombres)
    const filtrado = new RegistroHerramientas()
    for (const [nombre, entrada] of this.herramientas.entries()) {
      if (permitido.has(nombre)) {
        filtrado.registrar(entrada)
      }
    }
    return filtrado
  }
}
