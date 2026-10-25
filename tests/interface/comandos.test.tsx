import { PassThrough } from 'node:stream'
import { render } from 'ink'
import { describe, expect, it } from 'vitest'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { AppInteractiva } from '../../src/interface/app-interactiva.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

function crearSesion(): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado(),
    registro: new RegistroHerramientas(),
    modelosDisponibles: [
      'openrouter/openai/gpt-4o',
      'openrouter/deepseek/deepseek-chat',
    ],
    modeloActivo: 'openrouter/openai/gpt-4o',
    ventanaContexto: 2000,
  })
}

/**
 * Monta la TUI real con streams falsos para poder tipear como lo haría una
 * persona. `renderToString` no dispara `useInput`, así que no alcanza para
 * verificar la ejecución de comandos.
 */
function abrirInterfaz(sesion: SesionInteractiva) {
  const stdin = new PassThrough()
  Object.assign(stdin, {
    isTTY: true,
    setRawMode: () => {},
    ref: () => {},
    unref: () => {},
  })
  const stdout = new PassThrough()
  const partes: string[] = []
  stdout.on('data', (parte) => partes.push(String(parte)))
  Object.assign(stdout, { columns: 100, rows: 40 })

  const app = render(<AppInteractiva sesion={sesion} />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    debug: true,
    patchConsole: false,
    exitOnCtrlC: false,
  })

  return {
    app,
    salida: () => partes.join(''),
    escribir: async (texto: string) => {
      stdin.write(texto)
      await app.waitUntilRenderFlush()
    },
  }
}

describe('Requirement: La interfaz permite ejecutar comandos desde una lista', () => {
  it('Elegir un comando', async () => {
    // WHEN la persona selecciona un comando de la lista
    const sesion = crearSesion()
    const { app, salida, escribir } = abrirInterfaz(sesion)
    await escribir('/contexto')
    const antes = salida().length
    await escribir('\r')
    const despues = salida().slice(antes)
    app.unmount()

    // THEN la interfaz lo ejecuta y vuelve a la entrada
    expect(despues).toContain('Ventana total')
    expect(despues).not.toContain('/agente')
    expect(sesion.obtenerEstado().turnoEnCurso).toBe(false)
  })

  it('Comando desconocido', async () => {
    // WHEN la persona envía un comando que la sesión no reconoce
    const sesion = crearSesion()
    const { app, salida, escribir } = abrirInterfaz(sesion)
    await escribir('/zzz algo')
    await escribir('\r')
    const texto = salida()
    app.unmount()

    // THEN la interfaz muestra el error y no inicia un turno
    expect(texto).toContain('Comando desconocido: /zzz')
    expect(sesion.obtenerEstado().turnoEnCurso).toBe(false)
    expect(sesion.obtenerEstado().historial).toHaveLength(0)
  })
})
