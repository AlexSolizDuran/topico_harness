import { type ChildProcess, spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import type { ConfiguracionServidorLsp } from './types.js'

export interface OpcionesClienteLsp {
  timeoutMs?: number | undefined
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

      const mensaje = `Content-Length: ${Buffer.byteLength(cuerpo, 'utf8')}\r\n\r\n${cuerpo}`
      this.proceso.stdin.write(mensaje)
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
    const mensaje = `Content-Length: ${Buffer.byteLength(cuerpo, 'utf8')}\r\n\r\n${cuerpo}`
    this.proceso.stdin.write(mensaje)
  }

  public desconectar(): void {
    this.desconectado = true
    this.conectado = false
    if (this.proceso) {
      try {
        this.proceso.kill()
      } catch {
        // Ignorar
      }
      this.proceso = null
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
        }
      } catch {
        // Ignorar malformaciones
      }
    }
  }
}
