import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import { parsearArgumentos } from '../../src/args.js'
import { detectarTerminalInteractiva } from '../../src/interface/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

describe('Arranque desde la terminal', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-arranque-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('Arranque en el directorio del proyecto', async () => {
    // WHEN la persona ejecuta el harness desde un directorio
    writeFileSync(
      join(tempDir, 'saludo.txt'),
      'contenido del proyecto',
      'utf-8',
    )
    const { registro, sesion } = construirHarness({
      directorioProyecto: tempDir,
      proveedor: new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['listo'] }],
      }),
    })

    // THEN el sistema opera sobre ese directorio y sus archivos
    const read = registro.obtener('read')
    expect(read).toBeDefined()
    const contenido = await read?.ejecutar({ ruta: 'saludo.txt' })
    expect(contenido).toBe('contenido del proyecto')
    await sesion.enviarMensaje('leé el archivo')
  })

  it('Pedido inicial por argumentos', () => {
    // WHEN la invocación incluye texto después del nombre del comando
    const args = parsearArgumentos([
      '--dir',
      tempDir,
      'agregá',
      'una',
      'prueba',
    ])

    // THEN el sistema inicia un turno con ese texto como primer pedido
    expect(args.directorio).toBe(tempDir)
    expect(args.pedido).toBe('agregá una prueba')
  })

  it('Sin pedido inicial en una terminal interactiva', () => {
    // WHEN la invocación no incluye texto
    const args = parsearArgumentos([])

    // THEN el sistema queda a la espera de que la persona escriba
    expect(args.pedido).toBe('')
    expect(detectarTerminalInteractiva({ isTTY: true })).toBe(true)
  })
})
