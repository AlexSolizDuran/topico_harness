import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  cargarInstruccionesProyecto,
  DEFAULT_TOPE_INSTRUCCIONES_BYTES,
  ErrorInstruccionesExcedidas,
} from '../../src/instructions/cargar-instrucciones.js'

describe('cargarInstruccionesProyecto', () => {
  const dirs: string[] = []

  function crearDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-instr-'))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('lee AGENTS.md de la raíz del proyecto', () => {
    const dir = crearDir()
    writeFileSync(join(dir, 'AGENTS.md'), '# Reglas\nUsar TypeScript')
    const res = cargarInstruccionesProyecto(dir)
    expect(res?.contenido).toBe('# Reglas\nUsar TypeScript')
    expect(res?.tamanioBytes).toBe(Buffer.byteLength('# Reglas\nUsar TypeScript'))
  })

  it('continúa sin error si no existe AGENTS.md', () => {
    const dir = crearDir()
    const res = cargarInstruccionesProyecto(dir)
    expect(res).toBeNull()
  })

  it('no modifica el prompt si AGENTS.md está vacío', () => {
    const dir = crearDir()
    writeFileSync(join(dir, 'AGENTS.md'), '')
    const res = cargarInstruccionesProyecto(dir)
    expect(res).toBeNull()
  })

  it('no lee otros archivos Markdown como instrucciones', () => {
    const dir = crearDir()
    writeFileSync(join(dir, 'README.md'), '# Leer esto')
    const res = cargarInstruccionesProyecto(dir)
    expect(res).toBeNull()
  })

  it('lee una sola vez y falla si supera el tope', () => {
    const dir = crearDir()
    const contenido = 'a'.repeat(DEFAULT_TOPE_INSTRUCCIONES_BYTES + 1)
    writeFileSync(join(dir, 'AGENTS.md'), contenido)
    expect(() => cargarInstruccionesProyecto(dir)).toThrow(
      ErrorInstruccionesExcedidas,
    )
  })

  it('arranca si pesa exactamente el tope', () => {
    const dir = crearDir()
    const contenido = 'a'.repeat(DEFAULT_TOPE_INSTRUCCIONES_BYTES)
    writeFileSync(join(dir, 'AGENTS.md'), contenido)
    const res = cargarInstruccionesProyecto(dir)
    expect(res?.contenido.length).toBe(DEFAULT_TOPE_INSTRUCCIONES_BYTES)
  })

  it('el error nombra archivo, tamaño y tope', () => {
    const dir = crearDir()
    const contenido = 'b'.repeat(DEFAULT_TOPE_INSTRUCCIONES_BYTES + 10)
    const ruta = join(dir, 'AGENTS.md')
    writeFileSync(ruta, contenido)
    try {
      cargarInstruccionesProyecto(dir)
      throw new Error('debería fallar')
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorInstruccionesExcedidas)
      const e = error as ErrorInstruccionesExcedidas
      expect(e.message).toContain(ruta)
      expect(e.message).toContain(String(e.tamanio))
      expect(e.message).toContain(String(e.tope))
    }
  })

  it('no trunca si supera el tope', () => {
    const dir = crearDir()
    const contenido = 'c'.repeat(DEFAULT_TOPE_INSTRUCCIONES_BYTES + 5)
    writeFileSync(join(dir, 'AGENTS.md'), contenido)
    try {
      const res = cargarInstruccionesProyecto(dir)
      expect(res).toBeNull()
    } catch (error) {
      expect(error).toBeInstanceOf(ErrorInstruccionesExcedidas)
    }
  })
})
