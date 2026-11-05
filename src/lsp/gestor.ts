import { existsSync, readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { formatearColaSalida } from '../tools/truncate.js'
import { ClienteLsp } from './cliente.js'
import type {
  ConfiguracionServidorLsp,
  DiagnosticoLsp,
  OperacionLsp,
  PosicionLsp,
  SimboloLsp,
} from './types.js'

export interface OpcionesGestorLsp {
  servidores?: ConfiguracionServidorLsp[] | undefined
  timeoutMs?: number | undefined
  timeoutDiagnosticosMs?: number | undefined
  maxBytesSalida?: number | undefined
}

export class GestorLsp {
  private servidoresConfig = new Map<string, ConfiguracionServidorLsp>()
  private mapaExtensionALenguaje = new Map<string, string>()
  private clientes = new Map<string, ClienteLsp>()

  constructor(private readonly opciones: OpcionesGestorLsp = {}) {
    for (const s of opciones.servidores ?? []) {
      this.validarConfiguracionServidor(s)
      this.servidoresConfig.set(s.lenguaje.toLowerCase(), s)
      const exts = s.extensiones ?? [`.${s.lenguaje.toLowerCase()}`]
      for (const ext of exts) {
        const limpia = ext.startsWith('.')
          ? ext.toLowerCase()
          : `.${ext.toLowerCase()}`
        this.mapaExtensionALenguaje.set(limpia, s.lenguaje.toLowerCase())
      }
    }
  }

  public validarConfiguracionServidor(s: ConfiguracionServidorLsp): void {
    if (!s.lenguaje?.trim()) {
      throw new Error("Entrada de servidor LSP incompleta: falta 'lenguaje'")
    }
    if (!s.comando?.trim()) {
      throw new Error(
        `Entrada de servidor LSP incompleta para '${s.lenguaje}': falta 'comando'`,
      )
    }
    if (!s.raiz?.trim()) {
      throw new Error(
        `Entrada de servidor LSP incompleta para '${s.lenguaje}': falta 'raiz'`,
      )
    }
  }

  public resolverLenguajeDeArchivo(rutaArchivo: string): string | undefined {
    const ext = extname(rutaArchivo).toLowerCase()
    return this.mapaExtensionALenguaje.get(ext)
  }

  public async asegurarClienteParaArchivo(
    rutaArchivo: string,
  ): Promise<{ cliente?: ClienteLsp | undefined; error?: string | undefined }> {
    const lenguaje = this.resolverLenguajeDeArchivo(rutaArchivo)
    if (!lenguaje) {
      return {
        error: `ERROR: No hay un servidor de lenguaje configurado para el archivo '${rutaArchivo}'.`,
      }
    }
    return this.asegurarClienteParaLenguaje(lenguaje)
  }

  private async asegurarClienteParaLenguaje(
    lenguaje?: string | undefined,
  ): Promise<{ cliente?: ClienteLsp | undefined; error?: string | undefined }> {
    if (!lenguaje) {
      return { error: 'ERROR: No hay un servidor de lenguaje configurado.' }
    }

    const config = this.servidoresConfig.get(lenguaje)
    if (!config) {
      return {
        error: `ERROR: No hay configuración de servidor LSP para '${lenguaje}'.`,
      }
    }

    let cliente = this.clientes.get(lenguaje)
    if (!cliente?.estaConectado()) {
      try {
        cliente = new ClienteLsp(config, {
          timeoutMs: this.opciones.timeoutMs,
        })
        await cliente.conectar()
        this.clientes.set(lenguaje, cliente)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          error: `ERROR: Falló al iniciar el servidor LSP para '${lenguaje}': ${msg}`,
        }
      }
    }

    return { cliente }
  }

  public async ejecutarOperacion(
    operacion: OperacionLsp,
    ruta?: string | undefined,
    posicion?: PosicionLsp | undefined,
    simbolo?: string | undefined,
  ): Promise<string> {
    if (!ruta && operacion !== 'workspaceSymbols') {
      return `ERROR: La operación '${operacion}' requiere una ruta de archivo válida.`
    }

    const archivoObjetivo = ruta ?? ''
    const asegurado =
      operacion === 'workspaceSymbols' && !archivoObjetivo
        ? await this.asegurarClienteParaLenguaje(
            this.servidoresConfig.keys().next().value,
          )
        : await this.asegurarClienteParaArchivo(archivoObjetivo)
    if (asegurado.error || !asegurado.cliente) {
      return (
        asegurado.error ??
        `ERROR: Servidor LSP no disponible para '${archivoObjetivo}'.`
      )
    }

    const uri = pathToFileURL(resolve(archivoObjetivo)).href
    this.sincronizarDocumento(asegurado.cliente, archivoObjetivo, uri)

    try {
      let resultado = ''
      switch (operacion) {
        case 'definition': {
          if (!posicion)
            return 'ERROR: Se requiere línea y posición para definition.'
          const defs = (await asegurado.cliente.enviarPeticion(
            'textDocument/definition',
            {
              textDocument: { uri },
              position: { line: posicion.linea, character: posicion.caracter },
            },
          )) as unknown
          resultado = formatearUbicacionLsp(defs)
          break
        }
        case 'references': {
          if (!posicion)
            return 'ERROR: Se requiere línea y posición para references.'
          const refs = (await asegurado.cliente.enviarPeticion(
            'textDocument/references',
            {
              textDocument: { uri },
              position: { line: posicion.linea, character: posicion.caracter },
              context: { includeDeclaration: true },
            },
          )) as unknown
          resultado = formatearUbicacionLsp(refs)
          break
        }
        case 'hover': {
          if (!posicion)
            return 'ERROR: Se requiere línea y posición para hover.'
          const h = (await asegurado.cliente.enviarPeticion(
            'textDocument/hover',
            {
              textDocument: { uri },
              position: { line: posicion.linea, character: posicion.caracter },
            },
          )) as { contents?: unknown }
          resultado = formatearHover(h?.contents)
          break
        }
        case 'documentSymbols': {
          const syms = (await asegurado.cliente.enviarPeticion(
            'textDocument/documentSymbol',
            { textDocument: { uri } },
          )) as SimboloLsp[]
          resultado = formatearSimbolos(syms)
          break
        }
        case 'workspaceSymbols': {
          const syms = (await asegurado.cliente.enviarPeticion(
            'workspace/symbol',
            { query: simbolo ?? '' },
          )) as SimboloLsp[]
          resultado = formatearSimbolos(syms)
          break
        }
        case 'diagnostics': {
          resultado = await this.obtenerDiagnosticosDeArchivo(archivoObjetivo)
          break
        }
        default:
          return `ERROR: Operación LSP '${operacion}' no soportada.`
      }

      const maxBytes = this.opciones.maxBytesSalida ?? 64 * 1024
      return formatearColaSalida(resultado, maxBytes).cola
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `ERROR: Falló la operación LSP '${operacion}': ${msg}`
    }
  }

  public async obtenerDiagnosticosDeArchivo(
    rutaArchivo: string,
  ): Promise<string> {
    const asegurado = await this.asegurarClienteParaArchivo(rutaArchivo)
    if (asegurado.error || !asegurado.cliente) {
      return (
        asegurado.error ??
        `ERROR: Servidor LSP no disponible para '${rutaArchivo}'.`
      )
    }

    const cliente = asegurado.cliente
    const uri = pathToFileURL(resolve(rutaArchivo)).href

    try {
      // Los servidores reales publican diagnósticos al recibir didOpen o
      // didChange. Se espera esa publicación antes de recurrir al pull.
      const generacionPrevia =
        typeof cliente.obtenerGeneracionDiagnosticos === 'function'
          ? cliente.obtenerGeneracionDiagnosticos(uri)
          : -1
      this.sincronizarDocumento(cliente, rutaArchivo, uri)

      if (typeof cliente.esperarDiagnosticosPublicados === 'function') {
        await cliente.esperarDiagnosticosPublicados(
          uri,
          this.opciones.timeoutDiagnosticosMs,
        )
        const generacion =
          typeof cliente.obtenerGeneracionDiagnosticos === 'function'
            ? cliente.obtenerGeneracionDiagnosticos(uri)
            : -1
        if (generacion > generacionPrevia) {
          return this.formatearDiagnosticos(cliente.obtenerDiagnosticos(uri))
        }
      }

      const res = (await cliente.enviarPeticion('textDocument/diagnostic', {
        textDocument: { uri },
      })) as { items?: DiagnosticoLsp[] }

      return this.formatearDiagnosticos(res?.items ?? [])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `ERROR al obtener diagnósticos: ${msg}`
    }
  }

  private sincronizarDocumento(
    cliente: ClienteLsp,
    rutaArchivo: string,
    uri: string,
  ): void {
    if (typeof cliente.sincronizarDocumento !== 'function') return
    if (!existsSync(rutaArchivo)) return

    try {
      const texto = readFileSync(rutaArchivo, 'utf-8')
      const lenguaje =
        this.resolverLenguajeDeArchivo(rutaArchivo) ?? 'plaintext'
      cliente.sincronizarDocumento(uri, lenguaje, texto)
    } catch {
      // Sin contenido legible no se puede abrir el documento; la operación
      // sigue y el servidor responderá lo que tenga o fallará como texto.
    }
  }

  private formatearDiagnosticos(items: DiagnosticoLsp[]): string {
    if (items.length === 0) return ''
    const texto = items
      .map(
        (d) =>
          `[${d.gravedad?.toUpperCase() ?? 'ERROR'}] (${d.linea + 1}:${d.caracter + 1}): ${d.mensaje}`,
      )
      .join('\n')
    const maxBytes = this.opciones.maxBytesSalida ?? 64 * 1024
    return formatearColaSalida(texto, maxBytes).cola
  }

  public cerrar(): void {
    for (const c of this.clientes.values()) {
      c.desconectar()
    }
    this.clientes.clear()
  }
}

function formatearUbicacionLsp(defs: unknown): string {
  if (!defs) return 'No se encontraron ubicaciones.'
  if (Array.isArray(defs)) {
    if (defs.length === 0) return 'No se encontraron ubicaciones.'
    return defs
      .map(
        (d: {
          uri?: string
          range?: { start?: { line?: number; character?: number } }
        }) =>
          `${d.uri ?? 'archivo'} (${(d.range?.start?.line ?? 0) + 1}:${(d.range?.start?.character ?? 0) + 1})`,
      )
      .join('\n')
  }
  const d = defs as {
    uri?: string
    range?: { start?: { line?: number; character?: number } }
  }
  return `${d.uri ?? 'archivo'} (${(d.range?.start?.line ?? 0) + 1}:${(d.range?.start?.character ?? 0) + 1})`
}

function formatearHover(contents: unknown): string {
  if (!contents) return 'Sin información disponible.'
  if (typeof contents === 'string') return contents
  if (Array.isArray(contents)) return contents.join('\n')
  const obj = contents as { value?: string }
  return obj.value ?? JSON.stringify(contents)
}

function formatearSimbolos(syms: unknown): string {
  if (!Array.isArray(syms) || syms.length === 0)
    return 'Sin símbolos encontrados.'
  return syms
    .map(
      (s: { name?: string; kind?: unknown; containerName?: string }) =>
        `${s.name ?? 'anon'} (${s.kind ?? 'symbol'}) ${s.containerName ? `en ${s.containerName}` : ''}`,
    )
    .join('\n')
}
