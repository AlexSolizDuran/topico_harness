import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { construirHarness } from '../../src/app.js'
import type { ConfiguracionHarness } from '../../src/provider/config.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { determinarMecanismoAislamiento } from '../../src/sandbox/index.js'
import { crearHerramientaShell } from '../../src/tools/shell.js'

describe('Integración de sandbox', () => {
  it('informa una ejecución aislada', async () => {
    const shell = crearHerramientaShell({
      ejecutor: async () => ({
        salida: 'ok',
        codigoSalida: 0,
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      }),
    })
    const salida = await shell?.ejecutar({ comando: 'echo ok' })
    expect(salida).toContain('Aislamiento: activo (bwrap)')
  })

  it('informa una ejecución no aislada con motivo y aviso', async () => {
    const alAviso = vi.fn()
    const shell = crearHerramientaShell({
      ejecutor: async () => ({
        salida: 'ok',
        codigoSalida: 0,
        aislamiento: {
          aislado: false,
          motivoDegradacion: 'La plataforma no ofrece aislamiento.',
        },
      }),
      alAvisoAislamiento: alAviso,
    })
    const salida = await shell?.ejecutar({ comando: 'echo ok' })
    expect(salida).toContain('Aislamiento: no disponible')
    expect(salida).toContain('La plataforma no ofrece aislamiento.')
    expect(alAviso).toHaveBeenCalledTimes(1)
  })

  it('degrada cuando el mecanismo no está instalado', () => {
    const aislamiento = determinarMecanismoAislamiento({}, 'linux', () => false)
    expect(aislamiento.aislado).toBe(false)
    expect(aislamiento.motivoDegradacion).toContain('bwrap')
  })

  it('el mecanismo forzado no depende de la detección', () => {
    const aislamiento = determinarMecanismoAislamiento(
      { mecanismoForzado: 'bwrap' },
      'linux',
      () => false,
    )
    expect(aislamiento).toEqual({ aislado: true, mecanismo: 'bwrap' })
  })

  it('el harness muestra el aviso cuando el aislamiento está deshabilitado', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'harness-sandbox-app-'))
    const estados: string[] = []
    try {
      const config: ConfiguracionHarness = {
        proveedores: {
          local: {
            tipo: 'openai-compatible',
            baseUrl: 'http://localhost:11434/v1',
            modelos: [{ id: 'modelo' }],
          },
        },
        sandbox: { habilitado: false },
      }
      const harness = construirHarness({
        directorioProyecto: dir,
        proveedor: new ProveedorSimulado({ nombre: 'local', respuestas: [] }),
        config,
        esInteractivo: false,
        guardarSesiones: false,
        alActualizar: (estado) => {
          for (const entrada of estado.historial) {
            if (entrada.tipo === 'aviso') estados.push(entrada.texto)
          }
        },
      })

      const shell = harness.registro.obtener('shell')
      const salida = await shell?.ejecutar({ comando: 'echo hola' })
      expect(salida).toContain('Aislamiento: no disponible')
      expect(estados.some((texto) => texto.includes('sin aislamiento'))).toBe(
        true,
      )
      await harness.cerrar()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
