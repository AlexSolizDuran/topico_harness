import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EntradaHerramienta } from '../../src/core/registry.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import {
  type EstadoSesionVisual,
  SesionInteractiva,
} from '../../src/interface/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { crearCatalogoPorDefecto } from '../../src/tools/catalog.js'

function ultimoAviso(estado: EstadoSesionVisual): string | undefined {
  const avisos = estado.historial.filter((e) => e.tipo === 'aviso')
  const ultimo = avisos[avisos.length - 1]
  return ultimo?.tipo === 'aviso' ? ultimo.texto : undefined
}

describe('Sesión con contexto cableado', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-sesion-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('bloquea el envío si el presupuesto ya está excedido', async () => {
    const proveedor = new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['no debería llegar'] }],
    })
    const sesion = new SesionInteractiva({
      proveedor,
      registro: new RegistroHerramientas(),
      ventanaContexto: 100,
    })

    await sesion.enviarMensaje('x'.repeat(1000))

    expect(proveedor.peticionesRecibidas).toHaveLength(0)
    expect(sesion.obtenerEstado().turnoEnCurso).toBe(false)
    expect(ultimoAviso(sesion.obtenerEstado())).toContain('presupuesto')
  })

  it('propaga los tokens del provider al estado del turno', async () => {
    const proveedor = new ProveedorSimulado({
      respuestas: [
        {
          fragmentosTexto: ['ok'],
          tokens: { entrada: 7, salida: 3 },
        },
      ],
    })
    const sesion = new SesionInteractiva({
      proveedor,
      registro: new RegistroHerramientas(),
      ventanaContexto: 1000,
    })

    await sesion.enviarMensaje('hola')

    expect(sesion.obtenerUltimoTurno()?.tokens).toEqual({
      entrada: 7,
      salida: 3,
    })
    expect(sesion.obtenerMetricasContexto().tokensActuales).toBe(10)
    expect(sesion.obtenerMetricasContexto().tokensAcumulados).toBe(10)
    expect(sesion.obtenerMetricasContexto().esEstimado).toBe(false)
  })

  it('actualiza la ventana y el presupuesto al cambiar de modelo', () => {
    const sesion = new SesionInteractiva({
      proveedor: new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'openai/gpt-4o',
      }),
      registro: new RegistroHerramientas(),
      ventanaContexto: 1000,
      modelosDisponibles: ['openrouter/otro/modelo'],
      modeloActivo: 'openrouter/openai/gpt-4o',
      fabricaProveedor: () => ({
        proveedor: new ProveedorSimulado({
          nombre: 'openrouter',
          modelo: 'otro/modelo',
        }),
        ventanaContexto: 2000,
      }),
    })

    sesion.cambiarModelo('openrouter/otro/modelo')

    const estado = sesion.obtenerEstado()
    expect(estado.modeloActivo).toBe('openrouter/otro/modelo')
    expect(estado.contexto.ventanaContexto).toBe(2000)
    expect(estado.contexto.limitePresupuesto).toBe(1600)
    expect(estado.contexto.margenReservado).toBe(400)
  })

  it('avisa cuando el presupuesto no se puede satisfacer', async () => {
    const registro = new RegistroHerramientas()
    registro.registrar({
      nombre: 'leer_grande',
      descripcion: 'devuelve mucho contenido',
      esquema: {},
      ejecutar: async () => 'x'.repeat(4000),
    })
    const proveedor = new ProveedorSimulado({
      respuestas: [
        {
          llamadasHerramienta: [
            { id: 'c1', nombre: 'leer_grande', argumentos: {} },
          ],
        },
        { fragmentosTexto: ['fin'] },
      ],
    })
    const sesion = new SesionInteractiva({
      proveedor,
      registro,
      ventanaContexto: 1000,
    })

    await sesion.enviarMensaje('leé')

    expect(proveedor.peticionesRecibidas).toHaveLength(1)
    expect(ultimoAviso(sesion.obtenerEstado())).toContain(
      'por encima del presupuesto',
    )
  })

  it('redacta la credencial en el resultado de una herramienta', async () => {
    const secreto = 'sk-secreto-1234'
    const herramienta: EntradaHerramienta = {
      nombre: 'fallar',
      descripcion: 'falla con la credencial en el mensaje',
      esquema: { type: 'object', properties: {} },
      ejecutar: async () => {
        throw new Error(`no se pudo autenticar con ${secreto}`)
      },
    }
    const registro = new RegistroHerramientas()
    registro.registrar(herramienta)

    const proveedor = new ProveedorSimulado({
      respuestas: [
        {
          llamadasHerramienta: [{ id: 'c1', nombre: 'fallar', argumentos: {} }],
        },
        { fragmentosTexto: ['corregido'] },
      ],
    })
    const sesion = new SesionInteractiva({
      proveedor,
      registro,
      credencialesSanitizar: [secreto],
    })

    await sesion.enviarMensaje('probá la herramienta')

    const herramientaVisual = sesion
      .obtenerEstado()
      .historial.find((e) => e.tipo === 'herramienta')
    expect(herramientaVisual?.tipo).toBe('herramienta')
    if (herramientaVisual?.tipo === 'herramienta') {
      expect(herramientaVisual.resultado).not.toContain(secreto)
      expect(herramientaVisual.resultado).toContain('[REDACTADO]')
    }
  })

  it('lee un archivo con el catálogo apuntado al directorio del proyecto', async () => {
    writeFileSync(join(tempDir, 'grande.txt'), 'a'.repeat(4000), 'utf-8')
    const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
    const proveedor = new ProveedorSimulado({
      respuestas: [
        {
          llamadasHerramienta: [
            {
              id: 'c1',
              nombre: 'read',
              argumentos: { ruta: 'grande.txt' },
            },
          ],
          tokens: { entrada: 5000, salida: 100 },
        },
        { fragmentosTexto: ['listo'], tokens: { entrada: 5000, salida: 100 } },
      ],
    })
    const sesion = new SesionInteractiva({
      proveedor,
      registro,
      ventanaContexto: 1000,
    })

    await sesion.enviarMensaje('leé el archivo')

    const herramienta = sesion
      .obtenerEstado()
      .historial.find((e) => e.tipo === 'herramienta')
    expect(herramienta?.tipo).toBe('herramienta')
    if (herramienta?.tipo === 'herramienta') {
      expect(herramienta.resultado.length).toBe(4000)
      expect(herramienta.esError).toBe(false)
    }
  })
})
