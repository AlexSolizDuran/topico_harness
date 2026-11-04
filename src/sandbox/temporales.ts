import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export class GestorTemporalesSandbox {
  private temporalesActivos = new Set<string>()

  public crearTemporal(): string {
    const prefijo = join(tmpdir(), 'harness-sandbox-')
    const ruta = mkdtempSync(prefijo)
    this.temporalesActivos.add(ruta)
    return ruta
  }

  public limpiar(ruta: string): void {
    if (this.temporalesActivos.has(ruta)) {
      this.temporalesActivos.delete(ruta)
      try {
        if (existsSync(ruta)) {
          rmSync(ruta, { recursive: true, force: true })
        }
      } catch {
        // Ignorar errores al limpiar temporales
      }
    }
  }

  public limpiarTodos(): void {
    for (const ruta of this.temporalesActivos) {
      try {
        if (existsSync(ruta)) {
          rmSync(ruta, { recursive: true, force: true })
        }
      } catch {
        // Ignorar
      }
    }
    this.temporalesActivos.clear()
  }
}

