import type { DefinicionHerramienta } from '../provider/types.js'

export interface EntradaHerramienta {
  nombre: string
  descripcion: string
  esquema: Record<string, unknown>
  ejecutar: (argumentos: Record<string, unknown>) => Promise<string>
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

  listarDefiniciones(): DefinicionHerramienta[] {
    return Array.from(this.herramientas.values()).map((h) => ({
      nombre: h.nombre,
      descripcion: h.descripcion,
      esquema: h.esquema,
    }))
  }
}
