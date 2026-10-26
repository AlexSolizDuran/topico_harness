import { renderToString } from 'ink'
import { describe, expect, it } from 'vitest'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { BarraEstado } from '../../src/interface/app.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { crearEstadoInicial } from '../../src/interface/state.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { GestorTareasBackground } from '../../src/subagents/background.js'

describe('interface Specification Tests — background', () => {
  // -------------------------------------------------------------------------
  // Requirement: La interfaz muestra las tareas en background activas
  // -------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra las tareas en background activas', () => {
    it('La barra muestra tareas en curso', () => {
      // WHEN hay una o más tareas en background en curso
      const estado = {
        ...crearEstadoInicial(
          '',
          'openrouter/openai/gpt-4o',
          undefined,
          'build',
        ),
        tareasBackground: 2,
      }

      // THEN la barra de estado muestra su cantidad
      expect(renderToString(<BarraEstado estado={estado} />)).toContain('2 bg')
    })

    it('La espera al cerrar el turno es visible', async () => {
      // WHEN el turno del padre termina y espera tareas en background
      const gestor = new GestorTareasBackground()
      let liberar = (): void => {}
      const espera = new Promise<void>((resolve) => {
        liberar = resolve
      })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'investigá',
        ejecutar: async () => {
          await espera
          return 'hallazgo'
        },
      })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado({
          respuestas: [
            { fragmentosTexto: ['respuesta 1'] },
            { fragmentosTexto: ['respuesta 2'] },
          ],
        }),
        registro: new RegistroHerramientas(),
        ventanaContexto: 40_000,
        gestorTareas: gestor,
      })

      const promesa = sesion.enviarMensaje('hola')
      await new Promise((resolve) => setTimeout(resolve, 0))
      const aviso = sesion
        .obtenerEstado()
        .historial.find(
          (item) => item.tipo === 'aviso' && item.texto.includes('Esperando'),
        )
      liberar()
      await promesa

      // THEN la interfaz muestra un aviso de espera
      expect(aviso).toBeDefined()
    })
  })
})
