import { renderToString } from 'ink'
import { describe, expect, it } from 'vitest'
import { PresupuestoContexto } from '../../src/context/budget.js'
import { medirContexto } from '../../src/context/metrics.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import {
  BarraEstado,
  CajaEntrada,
  PaletaComandos,
  PanelContexto,
  SelectorModelo,
  TarjetaHerramienta,
} from '../../src/interface/app.js'
import { AppInteractiva } from '../../src/interface/app-interactiva.js'
import { COMANDOS, filtrarComandos } from '../../src/interface/commands.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { crearEstadoInicial } from '../../src/interface/state.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

function crearSesion(): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado({
      nombre: 'openrouter',
      modelo: 'openai/gpt-4o',
    }),
    registro: new RegistroHerramientas(),
    modelosDisponibles: [
      'openrouter/openai/gpt-4o',
      'openrouter/deepseek/deepseek-chat',
    ],
    modeloActivo: 'openrouter/openai/gpt-4o',
    ventanaContexto: 2000,
  })
}

describe('TUI', () => {
  it('muestra el modelo activo, el estado y la ayuda de entrada', () => {
    const salida = renderToString(
      <AppInteractiva sesion={crearSesion()} directorio="/proyecto" />,
    )

    expect(salida).toContain('openrouter/openai/gpt-4o')
    expect(salida).toContain('listo')
    expect(salida).toContain('/proyecto')
    expect(salida).toContain('Enter envía')
    expect(salida).toContain('Shift+Enter')
    expect(salida).toContain('/ comandos')
  })

  it('Abrir la lista', () => {
    const salida = renderToString(
      <PaletaComandos comandos={COMANDOS} seleccionado={0} />,
    )

    expect(salida).toContain('/modelo')
    expect(salida).toContain('/contexto')
    expect(salida).toContain('/ayuda')
    expect(salida).toContain('/salir')
  })

  it('filtra comandos y no inventa uno desconocido', () => {
    expect(filtrarComandos('mod').map((comando) => comando.id)).toEqual([
      'modelo',
    ])
    expect(filtrarComandos('zzz')).toHaveLength(0)
  })

  it('Elegir un modelo', () => {
    const salida = renderToString(
      <SelectorModelo
        modelos={[
          'openrouter/openai/gpt-4o',
          'openrouter/deepseek/deepseek-chat',
        ]}
        seleccionado={1}
        activo="openrouter/openai/gpt-4o"
        filtro=""
      />,
    )

    expect(salida).toContain('openrouter/openai/gpt-4o')
    expect(salida).toContain('● openrouter/openai/gpt-4o')
    expect(salida).toContain('› ○ openrouter/deepseek/deepseek-chat')
  })

  it('la herramienta en curso muestra nombre y argumentos', () => {
    const salida = renderToString(
      <TarjetaHerramienta
        nombre="read"
        argumentos={{ ruta: 'src/main.ts' }}
        enCurso
      />,
    )

    expect(salida).toContain('read')
    expect(salida).toContain('ruta=src/main.ts')
    expect(salida).toContain('en curso')
  })

  it('Uso actual visible', () => {
    const presupuesto = new PresupuestoContexto({
      ventanaContexto: 2000,
      porcentajeLimite: 0.8,
    })
    const metricas = medirContexto(
      presupuesto,
      [{ rol: 'user', contenido: 'x'.repeat(400) }],
      undefined,
      120,
    )

    const salida = renderToString(<PanelContexto metricas={metricas} />)

    expect(salida).toContain('Ventana total: 2.0k')
    expect(salida).toContain('Presupuesto: 1.6k')
    expect(salida).toContain('Uso actual: 100')
    expect(salida).toContain('Disponible: 1.5k')
    expect(salida).toContain('Consumo acumulado: 120')
    expect(salida).toContain('Última compactación: ninguna')
  })

  it('Conteo estimado', () => {
    // WHEN el provider no reportó el conteo de tokens
    const presupuesto = new PresupuestoContexto({ ventanaContexto: 2000 })
    const metricas = medirContexto(presupuesto, [
      { rol: 'user', contenido: 'x'.repeat(400) },
    ])

    const salida = renderToString(<PanelContexto metricas={metricas} />)

    // THEN la interfaz marca el uso como estimado
    expect(salida).toContain(', estimado')
  })

  it('la caja de entrada conserva las líneas del pedido', () => {
    const salida = renderToString(
      <CajaEntrada
        entrada={{ buffer: 'primera\nsegunda', cursor: 15 }}
        turnoEnCurso={false}
      />,
    )

    expect(salida).toContain('primera')
    expect(salida).toContain('segunda')
  })

  it('muestra la sesión como trabajando durante un turno', () => {
    const presupuesto = new PresupuestoContexto({ ventanaContexto: 2000 })
    const contexto = medirContexto(presupuesto, [])
    const estado = {
      ...crearEstadoInicial('', 'openrouter/openai/gpt-4o', contexto),
      turnoEnCurso: true,
    }

    const salida = renderToString(<BarraEstado estado={estado} />)

    expect(salida).toContain('trabajando')
    expect(salida).not.toContain('listo')
  })

  it('Después de compactar', () => {
    const presupuesto = new PresupuestoContexto({ ventanaContexto: 2000 })
    const metricas = medirContexto(
      presupuesto,
      [{ rol: 'user', contenido: 'x'.repeat(400) }],
      undefined,
      0,
      {
        antesTokens: 1000,
        despuesTokens: 500,
        antesMensajes: 10,
        despuesMensajes: 5,
      },
    )

    const salida = renderToString(<PanelContexto metricas={metricas} />)

    expect(salida).toContain('Última compactación: 1.0k → 500')
    expect(salida).toContain('10 → 5 mensajes')
  })
})
