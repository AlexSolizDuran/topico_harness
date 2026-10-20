import { describe, expect, it, vi } from 'vitest'
import { PresupuestoContexto } from '../../src/context/budget.js'
import { aplicarPipelineContexto } from '../../src/context/pipeline.js'
import type { Mensaje } from '../../src/types.js'

vi.mock('../../src/context/compaction.js', () => ({
  compactarHistorial: () => {
    throw new Error('falló la compactación')
  },
}))

describe('Pipeline de contexto', () => {
  it('captura un error de compactación sin romper el turno', () => {
    // WHEN la compactación falla al final del turno
    const presupuesto = new PresupuestoContexto({
      ventanaContexto: 1000,
      porcentajeLimite: 0.8,
    })
    const mensajes: Mensaje[] = [
      { rol: 'user', contenido: 'a'.repeat(1000) },
      { rol: 'assistant', contenido: 'b'.repeat(1000) },
      { rol: 'user', contenido: 'c'.repeat(1000) },
      { rol: 'assistant', contenido: 'd'.repeat(1000) },
    ]

    const resultado = aplicarPipelineContexto(mensajes, presupuesto, {
      entrada: 2000,
      salida: 0,
    })

    // THEN el error vuelve como dato y el historial queda sin compactar
    expect(resultado.compactado).toBe(false)
    expect(resultado.error).toContain('falló la compactación')
    expect(resultado.mensajes).toBe(mensajes)
  })
})
