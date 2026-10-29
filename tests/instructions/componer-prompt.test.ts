import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

describe('componer prompt con instrucciones', () => {
  const dirs: string[] = []

  function crearDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-prompt-'))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('inyecta AGENTS.md en el prompt de sistema con base -> instrucciones -> agente', () => {
    const dir = crearDir()
    writeFileSync(join(dir, 'AGENTS.md'), '# INSTRUCCIONES PROYECTO')
    const proveedor = new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const h = construirHarness({
      directorioProyecto: dir,
      proveedor,
      promptSistema: 'BASE',
      agentes: [
        {
          nombre: 'build',
          modo: 'primario',
          descripcion: 'test',
          herramientas: ['read'],
          prompt: 'PROMPT AGENTE',
        },
      ],
    })
    expect(h.sesion.obtenerEstado().promptSistema).toBe(
      'BASE\n\n# INSTRUCCIONES PROYECTO\n\nPROMPT AGENTE',
    )
  })

  it('conserva instrucciones al reanudar y al cambiar de agente', () => {
    const dir = crearDir()
    writeFileSync(join(dir, 'AGENTS.md'), '# INSTRUCCIONES PROYECTO')
    const proveedor = new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const h = construirHarness({
      directorioProyecto: dir,
      proveedor,
      promptSistema: 'BASE',
      agentes: [
        {
          nombre: 'build',
          modo: 'primario',
          descripcion: 'build',
          herramientas: ['read'],
          prompt: 'PROMPT BUILD',
        },
        {
          nombre: 'plan',
          modo: 'primario',
          descripcion: 'plan',
          herramientas: ['read'],
          prompt: 'PROMPT PLAN',
        },
      ],
    })
    expect(h.sesion.obtenerEstado().promptSistema).toContain(
      '# INSTRUCCIONES PROYECTO',
    )
    h.sesion.cambiarAgente('plan')
    expect(h.sesion.obtenerEstado().promptSistema).toBe(
      'BASE\n\n# INSTRUCCIONES PROYECTO\n\nPROMPT PLAN',
    )
  })
})
