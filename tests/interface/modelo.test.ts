import { describe, expect, it } from 'vitest'
import { RegistroHerramientas } from '../../src/core/index.js'
import {
  ErrorCambioModelo,
  type FabricaProveedor,
  SesionInteractiva,
} from '../../src/interface/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

const MODELO_A = 'openrouter/openai/gpt-4o'
const MODELO_B = 'openrouter/deepseek/deepseek-chat'

function crearSesion(
  fabrica: FabricaProveedor,
  proveedorInicial = new ProveedorSimulado({
    nombre: 'openrouter',
    modelo: 'openai/gpt-4o',
    respuestas: [{ fragmentosTexto: ['inicial'] }],
  }),
  modelos: string[] = [MODELO_A, MODELO_B],
): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: proveedorInicial,
    registro: new RegistroHerramientas(),
    modelosDisponibles: modelos,
    modeloActivo: MODELO_A,
    fabricaProveedor: fabrica,
  })
}

describe('Cambio de modelo en caliente', () => {
  it('Cambio entre turnos', async () => {
    // WHEN la persona cambia el modelo activo después de que un turno terminó
    const creados: ProveedorSimulado[] = []
    const fabrica: FabricaProveedor = (proveedorId, modeloId) => {
      const proveedor = new ProveedorSimulado({
        nombre: proveedorId,
        modelo: modeloId,
        respuestas: [{ fragmentosTexto: ['nuevo'] }],
      })
      creados.push(proveedor)
      return { proveedor, ventanaContexto: 64000 }
    }

    const inicial = new ProveedorSimulado({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      respuestas: [{ fragmentosTexto: ['inicial'] }],
    })
    const sesion = crearSesion(fabrica, inicial)

    await sesion.enviarMensaje('primer pedido')
    sesion.cambiarModelo(MODELO_B)
    await sesion.enviarMensaje('segundo pedido')

    // THEN el turno siguiente usa el modelo nuevo
    expect(sesion.obtenerModeloActivo()).toBe(MODELO_B)
    expect(inicial.peticionesRecibidas).toHaveLength(1)
    expect(creados[0]?.peticionesRecibidas).toHaveLength(1)
  })

  it('El historial se conserva', async () => {
    // WHEN se cambia de modelo en medio de una sesión
    const creados: ProveedorSimulado[] = []
    const fabrica: FabricaProveedor = (proveedorId, modeloId) => {
      const proveedor = new ProveedorSimulado({
        nombre: proveedorId,
        modelo: modeloId,
        respuestas: [{ fragmentosTexto: ['nuevo'] }],
      })
      creados.push(proveedor)
      return { proveedor }
    }

    const sesion = crearSesion(fabrica, undefined, [MODELO_A, MODELO_B])
    await sesion.enviarMensaje('pedido original')
    const antes = sesion.obtenerEstado().historial.length
    sesion.cambiarModelo(MODELO_B)
    await sesion.enviarMensaje('pedido siguiente')

    // THEN el historial previo se conserva y el turno siguiente continúa desde ahí
    const peticion = creados[0]?.peticionesRecibidas[0]
    expect(peticion?.mensajes[0]?.contenido).toBe('pedido original')
    expect(sesion.obtenerEstado().historial.length).toBeGreaterThan(antes)
  })

  it('Cambio durante un turno', async () => {
    // WHEN se pide cambiar de modelo mientras hay un turno en curso
    class ProveedorLento extends ProveedorSimulado {
      override async *enviar() {
        await new Promise((r) => setTimeout(r, 30))
        yield { tipo: 'texto' as const, delta: 'fin' }
      }
    }

    const fabrica: FabricaProveedor = () => {
      throw new Error('no debería llamarse')
    }
    const sesion = crearSesion(
      fabrica,
      new ProveedorLento({ nombre: 'openrouter' }),
    )

    const turno = sesion.enviarMensaje('tarea larga')
    expect(() => sesion.cambiarModelo(MODELO_B)).toThrow(ErrorCambioModelo)
    await turno

    // THEN el sistema rechaza el cambio y el turno en curso no se altera
    expect(sesion.obtenerModeloActivo()).toBe(MODELO_A)
  })

  it('Modelo desconocido', () => {
    // WHEN se pide un provider o un modelo que no está en la configuración
    const sesion = crearSesion(() => {
      throw new Error('no debería llamarse')
    })

    // THEN el sistema informa el error y mantiene el modelo activo anterior
    expect(() => sesion.cambiarModelo('openrouter/inexistente')).toThrow(
      /no está configurado/,
    )
    expect(sesion.obtenerModeloActivo()).toBe(MODELO_A)
  })

  it('Recalcula el presupuesto al cambiar de modelo', async () => {
    // WHEN el modelo nuevo tiene una ventana de contexto mucho menor
    const inicial = new ProveedorSimulado({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const nuevo = new ProveedorSimulado({
      nombre: 'openrouter',
      modelo: 'deepseek/deepseek-chat',
      respuestas: [{ fragmentosTexto: ['no debería llegar'] }],
    })
    const sesion = new SesionInteractiva({
      proveedor: inicial,
      registro: new RegistroHerramientas(),
      modelosDisponibles: [MODELO_A, MODELO_B],
      modeloActivo: MODELO_A,
      ventanaContexto: 128000,
      fabricaProveedor: () => ({ proveedor: nuevo, ventanaContexto: 100 }),
    })

    await sesion.enviarMensaje('a'.repeat(400))
    sesion.cambiarModelo(MODELO_B)
    await sesion.enviarMensaje('b'.repeat(400))

    // THEN el límite nuevo bloquea el envío antes de llamar al provider
    expect(inicial.peticionesRecibidas).toHaveLength(1)
    expect(nuevo.peticionesRecibidas).toHaveLength(0)
    const avisos = sesion
      .obtenerEstado()
      .historial.filter((elemento) => elemento.tipo === 'aviso')
    const ultimo = avisos[avisos.length - 1]
    expect(ultimo?.tipo === 'aviso' ? ultimo.texto : '').toContain(
      'presupuesto',
    )
  })

  it('Falta la credencial del modelo nuevo', () => {
    // WHEN el provider elegido no tiene su credencial en el entorno
    const fabrica: FabricaProveedor = () => {
      throw new Error('Falta la credencial requerida en la variable de entorno')
    }
    const sesion = crearSesion(fabrica)

    // THEN el sistema no activa el cambio y mantiene el modelo anterior
    expect(() => sesion.cambiarModelo(MODELO_B)).toThrow(/credencial/)
    expect(sesion.obtenerModeloActivo()).toBe(MODELO_A)
  })
})
