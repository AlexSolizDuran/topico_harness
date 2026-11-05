import { type ChildProcess, spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import type { ConfiguracionServidorLsp, DiagnosticoLsp } from './types.js'

export interface OpcionesClienteLsp {
  timeoutMs?: number | undefined
  timeoutDiagnosticosMs?: number | undefined
}

type EsperadorDiagnosticos = () => void

interface NotificacionDiagnosticosLsp {
  uri?: string
  diagnostics?: Array<{
    message?: string
    severity?: number
    range?: { start?: { line?: number; character?: number } }
  }>
}

const GRAVEDADES: Record<number, DiagnosticoLsp['gravedad']> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
}

function formatearMensajeLsp(cuerpo: Record<string, unknown>): string {
  const texto = JSON.stringify(cuerpo)
  return `Content-Length: ${Buffer.byteLength(texto, 'utf8')}\r\n\r\n${texto}`
}

export class ClienteLsp {
  private proceso: ChildProcess | null = null
  private bufferEntrada = Buffer.alloc(0)
  private idPeticion = 1
  private respuestasPendientes = new Map<
    number,
    {
      resolve: (valor: unknown) => void
      reject: (err: Error) => void
      timer: NodeJS.Timeout
    }
  >()
  private conectado = false
  private desconectado = false
  private documentosAbiertos = new Set<string>()
  private versionesDocumentos = new Map<string, number>()
  private diagnosticos = new Map<string, DiagnosticoLsp[]>()
  private generacionDiagnosticos = new Map<string, number>()
  private esperadoresDiagnosticos = new Map<string, EsperadorDiagnosticos[]>()
  private esperadoresNuevos = new Map<string, EsperadorDiagnosticos[]>()

  constructor(
    public readonly config: ConfiguracionServidorLsp,
    private readonly opciones: OpcionesClienteLsp = {},
  ) {}

  public estaConectado(): boolean {
    return this.conectado && this.proceso !== null && !this.desconectado
  }

  public async conectar(): Promise<void> {
    if (this.estaConectado()) return
    this.desconectado = false

    return new Promise((resolve, reject) => {
      let conexionRechazada = false
      const timeoutConexion = setTimeout(() => {
        if (!this.conectado) {
          conexionRechazada = true
          this.desconectar()
          reject(
            new Error(
              `Timeout al conectar con servidor LSP para lenguaje '${this.config.lenguaje}'`,
            ),
          )
        }
      }, this.opciones.timeoutMs ?? 30000)

      try {
        const proc = spawn(this.config.comando, this.config.args ?? [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
        })

        this.proceso = proc

        proc.on('error', (err) => {
          clearTimeout(timeoutConexion)
          this.desconectar()
          if (!conexionRechazada) {
            conexionRechazada = true
            reject(
              new Error(
                `Error al iniciar servidor LSP '${this.config.lenguaje}': ${err.message}`,
              ),
            )
          }
        })

        proc.on('exit', () => {
          this.desconectar()
          for (const [, pendiente] of this.respuestasPendientes) {
            clearTimeout(pendiente.timer)
            pendiente.reject(
              new Error(
                `Servidor LSP '${this.config.lenguaje}' finalizó inesperadamente`,
              ),
            )
          }
          this.respuestasPendientes.clear()
        })

        if (!proc.stdout || !proc.stdin) {
          clearTimeout(timeoutConexion)
          this.desconectar()
          reject(
            new Error(
              `Canales stdio no disponibles para servidor LSP '${this.config.lenguaje}'`,
            ),
          )
          return
        }

        proc.stdout.on('data', (chunk: Buffer) => {
          this.procesarChunkEntrada(chunk)
        })

        const rootUri = pathToFileURL(this.config.raiz).href

        // Handshake: initialize
        this.enviarPeticion('initialize', {
          processId: process.pid,
          rootUri,
          capabilities: {},
        })
          .then(() => {
            this.enviarNotificacion('initialized', {})
            this.conectado = true
            clearTimeout(timeoutConexion)
            resolve()
          })
          .catch((err) => {
            clearTimeout(timeoutConexion)
            this.desconectar()
            reject(err)
          })
      } catch (err: unknown) {
        clearTimeout(timeoutConexion)
        this.desconectar()
        const mensaje = err instanceof Error ? err.message : String(err)
        reject(
          new Error(
            `No se pudo arrancar servidor LSP '${this.config.lenguaje}': ${mensaje}`,
          ),
        )
      }
    })
  }

  public async enviarPeticion(
    metodo: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proceso?.stdin?.writable) {
        reject(
          new Error(
            `Servidor LSP '${this.config.lenguaje}' no está disponible para escribir`,
          ),
        )
        return
      }

      const id = this.idPeticion++
      const timeoutMs = this.opciones.timeoutMs ?? 30000

      const timer = setTimeout(() => {
        this.respuestasPendientes.delete(id)
        reject(
          new Error(
            `Timeout de respuesta LSP en servidor '${this.config.lenguaje}' para método ${metodo}`,
          ),
        )
      }, timeoutMs)

      this.respuestasPendientes.set(id, { resolve, reject, timer })

      const cuerpo = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: metodo,
        params,
      })

      this.proceso.stdin.write(formatearMensajeLsp(JSON.parse(cuerpo)))
    })
  }

  public enviarNotificacion(
    metodo: string,
    params: Record<string, unknown>,
  ): void {
    if (!this.proceso?.stdin?.writable) return
    const cuerpo = JSON.stringify({
      jsonrpc: '2.0',
      method: metodo,
      params,
    })
    this.proceso.stdin.write(formatearMensajeLsp(JSON.parse(cuerpo)))
  }

  /**
   * Abre el documento una sola vez por conexión. Los servidores reales no
   * publican diagnósticos de un archivo hasta que lo conocen.
   */
  public abrirDocumento(uri: string, lenguaje: string, texto: string): void {
    if (this.documentosAbiertos.has(uri)) return
    this.sincronizarDocumento(uri, lenguaje, texto)
  }

  /**
   * Envía el contenido actual al servidor. Un archivo ya abierto se actualiza
   * con `didChange`: las ediciones del harness ocurren fuera del LSP y sin esto
   * el servidor seguiría analizando la versión anterior.
   */
  public sincronizarDocumento(
    uri: string,
    lenguaje: string,
    texto: string,
  ): void {
    if (!this.estaConectado()) return

    const version = (this.versionesDocumentos.get(uri) ?? 0) + 1
    this.versionesDocumentos.set(uri, version)

    if (!this.documentosAbiertos.has(uri)) {
      this.documentosAbiertos.add(uri)
      this.enviarNotificacion('textDocument/didOpen', {
        textDocument: { uri, languageId: lenguaje, version, text: texto },
      })
      return
    }

    this.enviarNotificacion('textDocument/didChange', {
      textDocument: { uri, version },
      contentChanges: [{ text: texto }],
    })
  }

  public obtenerDiagnosticos(uri: string): DiagnosticoLsp[] {
    return [...(this.diagnosticos.get(uri) ?? [])]
  }

  public obtenerGeneracionDiagnosticos(uri: string): number {
    return this.generacionDiagnosticos.get(uri) ?? 0
  }

  /**
   * Espera una publicación posterior a la llamada. A diferencia de
   * `esperarDiagnosticos`, no devuelve la lista vieja en caché: el llamador
   * necesita saber si el servidor analizó el contenido nuevo.
   */
  public esperarDiagnosticosPublicados(
    uri: string,
    timeoutMs?: number | undefined,
  ): Promise<DiagnosticoLsp[]> {
    const generacion = this.obtenerGeneracionDiagnosticos(uri)
    if (!this.estaConectado()) {
      return Promise.resolve(this.obtenerDiagnosticos(uri))
    }

    return new Promise((resolve) => {
      let resuelto = false
      let despertar: EsperadorDiagnosticos = () => {}

      const finalizar = (): void => {
        if (resuelto) return
        resuelto = true
        clearTimeout(timer)
        const lista = this.esperadoresNuevos.get(uri) ?? []
        const indice = lista.indexOf(despertar)
        if (indice >= 0) lista.splice(indice, 1)
        if (lista.length === 0) this.esperadoresNuevos.delete(uri)
        resolve(this.obtenerDiagnosticos(uri))
      }

      despertar = () => {
        if (this.obtenerGeneracionDiagnosticos(uri) > generacion) finalizar()
      }

      const timer = setTimeout(
        finalizar,
        timeoutMs ?? this.opciones.timeoutDiagnosticosMs ?? 500,
      )
      const lista = this.esperadoresNuevos.get(uri) ?? []
      lista.push(despertar)
      this.esperadoresNuevos.set(uri, lista)
    })
  }

  /**
   * Espera la notificación `publishDiagnostics` del archivo. No todos los
   * servidores publican: al vencer el plazo se devuelve una lista vacía para
   * que el llamador pueda degradar a la consulta por pull.
   */
  public esperarDiagnosticos(
    uri: string,
    timeoutMs?: number | undefined,
  ): Promise<DiagnosticoLsp[]> {
    const actuales = this.diagnosticos.get(uri)
    if (actuales) return Promise.resolve([...actuales])

    return new Promise((resolve) => {
      let resuelto = false
      const finalizar = (): void => {
        if (resuelto) return
        resuelto = true
        clearTimeout(timer)
        const lista = this.esperadoresDiagnosticos.get(uri) ?? []
        const indice = lista.indexOf(despertar)
        if (indice >= 0) lista.splice(indice, 1)
        if (lista.length === 0) this.esperadoresDiagnosticos.delete(uri)
        resolve([...(this.diagnosticos.get(uri) ?? [])])
      }
      const despertar: EsperadorDiagnosticos = finalizar
      const timer = setTimeout(
        finalizar,
        timeoutMs ?? this.opciones.timeoutDiagnosticosMs ?? 500,
      )
      const lista = this.esperadoresDiagnosticos.get(uri) ?? []
      lista.push(despertar)
      this.esperadoresDiagnosticos.set(uri, lista)
    })
  }

  public desconectar(): void {
    const proc = this.proceso
    const debeApagarOrdenado =
      this.conectado && !this.desconectado && Boolean(proc?.stdin?.writable)

    this.desconectado = true
    this.conectado = false
    this.proceso = null
    this.documentosAbiertos.clear()
    this.versionesDocumentos.clear()
    this.diagnosticos.clear()
    this.generacionDiagnosticos.clear()
    this.esperadoresDiagnosticos.clear()
    this.esperadoresNuevos.clear()

    if (!proc) return

    if (debeApagarOrdenado && proc.stdin?.writable) {
      try {
        const apagado = JSON.stringify({
          jsonrpc: '2.0',
          id: this.idPeticion++,
          method: 'shutdown',
          params: {},
        })
        proc.stdin.write(formatearMensajeLsp(JSON.parse(apagado)))
        const salida = JSON.stringify({
          jsonrpc: '2.0',
          method: 'exit',
          params: {},
        })
        proc.stdin.write(formatearMensajeLsp(JSON.parse(salida)))
        proc.stdin.end()
      } catch {
        // El proceso ya no acepta escritura; se cae al kill.
      }
    }

    try {
      proc.kill()
    } catch {
      // Ignorar
    }
  }

  private procesarChunkEntrada(chunk: Buffer): void {
    this.bufferEntrada = Buffer.concat([this.bufferEntrada, chunk])

    while (true) {
      const indiceEncabezado = this.bufferEntrada.indexOf('\r\n\r\n')
      if (indiceEncabezado === -1) break

      const textoEncabezados = this.bufferEntrada
        .subarray(0, indiceEncabezado)
        .toString('utf8')
      const matchLongitud = /Content-Length:\s*(\d+)/i.exec(textoEncabezados)
      if (!matchLongitud || !matchLongitud[1]) {
        this.bufferEntrada = this.bufferEntrada.subarray(indiceEncabezado + 4)
        continue
      }

      const longitudCuerpo = Number.parseInt(matchLongitud[1], 10)
      const inicioCuerpo = indiceEncabezado + 4
      if (this.bufferEntrada.length < inicioCuerpo + longitudCuerpo) {
        // Esperar más datos
        break
      }

      const textoCuerpo = this.bufferEntrada
        .subarray(inicioCuerpo, inicioCuerpo + longitudCuerpo)
        .toString('utf8')
      this.bufferEntrada = this.bufferEntrada.subarray(
        inicioCuerpo + longitudCuerpo,
      )

      try {
        const parsed = JSON.parse(textoCuerpo) as {
          id?: number
          method?: string
          params?: unknown
          result?: unknown
          error?: { message?: string }
        }

        if (typeof parsed.id === 'number') {
          const pendiente = this.respuestasPendientes.get(parsed.id)
          if (pendiente) {
            clearTimeout(pendiente.timer)
            this.respuestasPendientes.delete(parsed.id)
            if (parsed.error) {
              pendiente.reject(
                new Error(parsed.error.message ?? 'Error LSP devuelto'),
              )
            } else {
              pendiente.resolve(parsed.result)
            }
          }
          continue
        }

        if (parsed.method) {
          this.procesarNotificacion(parsed.method, parsed.params)
        }
      } catch {
        // Ignorar malformaciones
      }
    }
  }

  private procesarNotificacion(metodo: string, params: unknown): void {
    if (metodo !== 'textDocument/publishDiagnostics') return
    const notificacion = params as NotificacionDiagnosticosLsp | undefined
    const uri = notificacion?.uri
    if (typeof uri !== 'string') return

    const items = Array.isArray(notificacion?.diagnostics)
      ? notificacion.diagnostics
      : []
    this.diagnosticos.set(
      uri,
      items.map((d) => ({
        mensaje: d.message ?? 'Diagnóstico sin mensaje',
        gravedad: d.severity ? GRAVEDADES[d.severity] : 'error',
        linea: d.range?.start?.line ?? 0,
        caracter: d.range?.start?.character ?? 0,
      })),
    )
    this.generacionDiagnosticos.set(
      uri,
      this.obtenerGeneracionDiagnosticos(uri) + 1,
    )

    for (const despertar of [...(this.esperadoresNuevos.get(uri) ?? [])]) {
      despertar()
    }
  }
}
