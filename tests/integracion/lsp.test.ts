import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import type { ConfiguracionHarness } from '../../src/provider/config.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { ejecutarTurnoSubagente } from '../../src/subagents/ejecutor.js'

const SERVIDOR_LSP_FALSO = String.raw`
const fs = require('node:fs')
let buffer = Buffer.alloc(0)

function enviar(objeto) {
  const texto = JSON.stringify(objeto)
  process.stdout.write(
    'Content-Length: ' + Buffer.byteLength(texto, 'utf8') + '\r\n\r\n' + texto,
  )
}

function publicar(uri, texto) {
  const diagnosticos = []
  if (typeof texto === 'string' && texto.includes('MAL')) {
    diagnosticos.push({
      message: 'Tipo incompatible: se esperaba number',
      severity: 1,
      range: { start: { line: 0, character: 0 } },
    })
  }
  enviar({
    jsonrpc: '2.0',
    method: 'textDocument/publishDiagnostics',
    params: { uri, diagnostics: diagnosticos },
  })
}

function manejar(mensaje) {
  if (mensaje.method === 'initialize') {
    enviar({ jsonrpc: '2.0', id: mensaje.id, result: { capabilities: {} } })
    return
  }
  if (mensaje.method === 'initialized') return
  if (mensaje.method === 'textDocument/didOpen') {
    publicar(
      mensaje.params.textDocument.uri,
      mensaje.params.textDocument.text,
    )
    return
  }
  if (mensaje.method === 'textDocument/didChange') {
    publicar(
      mensaje.params.textDocument.uri,
      mensaje.params.contentChanges[0] && mensaje.params.contentChanges[0].text,
    )
    return
  }
  if (mensaje.method === 'textDocument/hover') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: { contents: { kind: 'plaintext', value: 'function saludar(): void' } },
    })
    return
  }
  if (mensaje.method === 'textDocument/definition') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: {
        uri: mensaje.params.textDocument.uri,
        range: { start: { line: 10, character: 2 } },
      },
    })
    return
  }
  if (mensaje.method === 'textDocument/references') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: [
        { uri: 'file:///proyecto/otro.ts', range: { start: { line: 1, character: 1 } } },
      ],
    })
    return
  }
  if (mensaje.method === 'textDocument/documentSymbol') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: [{ name: 'saludar', kind: 12 }],
    })
    return
  }
  if (mensaje.method === 'workspace/symbol') {
    enviar({
      jsonrpc: '2.0',
      id: mensaje.id,
      result: [{ name: 'GlobalSaludo', kind: 12 }],
    })
    return
  }
  if (mensaje.method === 'textDocument/diagnostic') {
    enviar({ jsonrpc: '2.0', id: mensaje.id, result: { items: [] } })
    return
  }
  if (mensaje.method === 'shutdown') {
    enviar({ jsonrpc: '2.0', id: mensaje.id, result: null })
    return
  }
  if (mensaje.method === 'exit') {
    process.exit(0)
  }
  if (mensaje.id !== undefined) {
    enviar({ jsonrpc: '2.0', id: mensaje.id, result: null })
  }
}

process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    const separador = buffer.indexOf('\r\n\r\n')
    if (separador < 0) break
    const encabezado = buffer.subarray(0, separador).toString('utf8')
    const longitud = /Content-Length:\s*(\d+)/i.exec(encabezado)
    if (!longitud) {
      buffer = buffer.subarray(separador + 4)
      continue
    }
    const bytes = Number.parseInt(longitud[1], 10)
    if (buffer.length < separador + 4 + bytes) break
    const cuerpo = buffer
      .subarray(separador + 4, separador + 4 + bytes)
      .toString('utf8')
    buffer = buffer.subarray(separador + 4 + bytes)
    try {
      manejar(JSON.parse(cuerpo))
    } catch {}
  }
})

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
process.on('exit', () => {
  const archivo = process.argv[2]
  if (archivo) fs.writeFileSync(archivo, 'terminado')
})
`

describe('Integración de LSP', () => {
  const dirs: string[] = []

  function crearProyecto(opciones: { lsp: boolean }): {
    dir: string
    salidaServidor: string
    config: ConfiguracionHarness
  } {
    const dir = mkdtempSync(join(tmpdir(), 'harness-lsp-integracion-'))
    dirs.push(dir)
    mkdirSync(join(dir, 'src'), { recursive: true })
    writeFileSync(join(dir, 'src', 'a.ts'), 'const a = 1\n', 'utf-8')

    const salidaServidor = join(dir, 'lsp-terminado.txt')
    const rutaServidor = join(dir, 'lsp-falso.cjs')
    writeFileSync(rutaServidor, SERVIDOR_LSP_FALSO, 'utf-8')

    const config: ConfiguracionHarness = {
      proveedores: {
        local: {
          tipo: 'openai-compatible',
          baseUrl: 'http://localhost:11434/v1',
          modelos: [{ id: 'modelo' }],
        },
      },
      ...(opciones.lsp
        ? {
            lsp: [
              {
                lenguaje: 'ts',
                extensiones: ['.ts'],
                comando: process.execPath,
                args: [rutaServidor, salidaServidor],
                raiz: '.',
              },
            ],
          }
        : {}),
    }
    return { dir, salidaServidor, config }
  }

  function crearHarness(
    dir: string,
    config: ConfiguracionHarness,
    respuestas: ConstructorParameters<typeof ProveedorSimulado>[0] = {},
  ) {
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      ...respuestas,
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config,
      esInteractivo: false,
      guardarSesiones: false,
    })
    return { harness, proveedor }
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('expone definición, referencias, símbolos, hover y diagnósticos contra un servidor real', async () => {
    const { dir, config } = crearProyecto({ lsp: true })
    const { harness } = crearHarness(dir, config)

    const lsp = harness.registro.obtener('lsp')
    expect(lsp).toBeDefined()

    const hover = await lsp?.ejecutar({
      operacion: 'hover',
      ruta: 'src/a.ts',
      linea: 0,
      caracter: 1,
    })
    expect(hover).toContain('function saludar(): void')

    const definicion = await lsp?.ejecutar({
      operacion: 'definition',
      ruta: 'src/a.ts',
      linea: 0,
      caracter: 1,
    })
    expect(definicion).toContain('(11:3)')

    const referencias = await lsp?.ejecutar({
      operacion: 'references',
      ruta: 'src/a.ts',
      linea: 0,
      caracter: 1,
    })
    expect(referencias).toContain('otro.ts')

    const simbolos = await lsp?.ejecutar({
      operacion: 'documentSymbols',
      ruta: 'src/a.ts',
    })
    expect(simbolos).toContain('saludar')

    const workspace = await lsp?.ejecutar({
      operacion: 'workspaceSymbols',
      simbolo: 'Global',
    })
    expect(workspace).toContain('GlobalSaludo')

    await harness.cerrar()
  })

  it('sin servidores configurados devuelve el error como texto y no rompe el turno', async () => {
    const { dir, config } = crearProyecto({ lsp: false })
    const { harness } = crearHarness(dir, config)

    const lsp = harness.registro.obtener('lsp')
    const salida = await lsp?.ejecutar({
      operacion: 'hover',
      ruta: 'src/a.ts',
      linea: 0,
      caracter: 1,
    })
    expect(salida).toContain('No hay un servidor de lenguaje configurado')

    await harness.cerrar()
  })

  it('agrega diagnósticos truncados después de editar y no revierte la edición', async () => {
    const { dir, config } = crearProyecto({ lsp: true })
    const { harness } = crearHarness(dir, config)
    const ruta = join(dir, 'src', 'editado.ts')
    writeFileSync(ruta, 'const valor = 1\n', 'utf-8')

    const edit = harness.registro.obtener('edit')
    const conError = await edit?.ejecutar({
      ruta: 'src/editado.ts',
      buscar: 'const valor = 1',
      reemplazar: 'const valor: number = MAL',
    })
    expect(conError).toContain('Diagnósticos:')
    expect(conError).toContain('[ERROR] (1:1)')
    expect(readFileSync(ruta, 'utf-8')).toContain('MAL')

    const sinError = await edit?.ejecutar({
      ruta: 'src/editado.ts',
      buscar: 'const valor: number = MAL',
      reemplazar: 'const valor: number = 1',
    })
    expect(sinError).not.toContain('Diagnósticos:')

    await harness.cerrar()
  })

  it('cierra el servidor con la sesión sin dejar procesos vivos', async () => {
    const { dir, config, salidaServidor } = crearProyecto({ lsp: true })
    const { harness } = crearHarness(dir, config)

    await harness.registro.obtener('lsp')?.ejecutar({
      operacion: 'hover',
      ruta: 'src/a.ts',
      linea: 0,
      caracter: 1,
    })

    await harness.cerrar()
    for (
      let intento = 0;
      intento < 40 && !existsSync(salidaServidor);
      intento++
    ) {
      await new Promise((resolver) => setTimeout(resolver, 50))
    }
    expect(existsSync(salidaServidor)).toBe(true)
  })

  it('un subagente recibe lsp solo si lo declara y es de solo lectura', async () => {
    const { dir, config } = crearProyecto({ lsp: true })
    const { harness } = crearHarness(dir, config)

    const conLsp = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['listo'] }],
    })
    const resultado = await ejecutarTurnoSubagente({
      subagente: {
        nombre: 'explora',
        descripcion: 'solo lectura',
        modo: 'subagente',
        herramientas: ['read', 'lsp'],
      },
      pedido: 'revisá el archivo',
      catalogo: harness.registro,
      proveedorPadre: conLsp,
    })
    expect(resultado.esError).toBe(false)
    expect(
      conLsp.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre),
    ).toContain('lsp')

    const sinLsp = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['listo'] }],
    })
    await ejecutarTurnoSubagente({
      subagente: {
        nombre: 'explora',
        descripcion: 'solo lectura',
        modo: 'subagente',
        herramientas: ['read'],
      },
      pedido: 'revisá el archivo',
      catalogo: harness.registro,
      proveedorPadre: sinLsp,
    })
    expect(
      sinLsp.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre),
    ).not.toContain('lsp')

    await harness.cerrar()
  })
})
