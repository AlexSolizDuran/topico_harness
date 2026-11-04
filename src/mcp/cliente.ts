import { type ChildProcess, spawn } from 'node:child_process'
import readline from 'node:readline'
import { z } from 'zod'
import type { ConfiguracionServidorMcp, HerramientaMcp } from './types.js'

export interface OpcionesClienteMcp {
  timeoutMs?: number | undefined
  sanitizarCredenciales?: ((texto: string) => string) | undefined
}

export class ClienteMcp {
  private proceso: ChildProcess | null = null
  private lineReader: readline.Interface | null = null
  private idPeticion = 1
  private respuestasPendientes = new Map<
    number,
    {
      resolve: (valor: unknown) => void
      reject: (err: Error) => void
      timer: NodeJS.Timeout
    }
  >()
  private herramientas: HerramientaMcp[] = []
  private conectado = false
  private desconectado = false

  constructor(
    public readonly config: ConfiguracionServidorMcp,
    private readonly opciones: OpcionesClienteMcp = {},
  ) {}

  public estaConectado(): boolean {
    return this.conectado && this.proceso !== null && !this.desconectado
  }

  public obtenerHerramientas(): HerramientaMcp[] {
    return this.herramientas
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
              `Timeout al conectar con servidor MCP '${this.config.id}'`,
            ),
          )
        }
      }, this.opciones.timeoutMs ?? 30000)

      try {
        const proc = spawn(this.config.comando, this.config.args ?? [], {
          env: { ...process.env, ...this.config.env },
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
                `Error al iniciar servidor MCP '${this.config.id}': ${err.message}`,
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
                `Servidor MCP '${this.config.id}' finalizó inesperadamente`,
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
              `Canales stdio no disponibles para servidor '${this.config.id}'`,
            ),
          )
          return
        }

        this.lineReader = readline.createInterface({
          input: proc.stdout,
          crlfDelay: Infinity,
        })

        this.lineReader.on('line', (linea) => {
          this.procesarMensaje(linea)
        })

        // Handshake: initialize
        this.enviarPeticion('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'harness', version: '0.1.0' },
        })
          .then(async () => {
            // Notifications initialized
            this.enviarNotificacion('notifications/initialized', {})
            // tools/list
            const lista = (await this.enviarPeticion('tools/list', {})) as {
              tools?: Array<{
                name: string
                description?: string
                inputSchema?: Record<string, unknown>
                riesgoso?: boolean
                motivoRiesgo?: string
              }>
            }
            this.herramientas = (lista.tools ?? []).map((t) => ({
              nombre: t.name,
              nombreCompleto: `${this.config.id}_${t.name}`,
              servidor: this.config.id,
              descripcion:
                t.description ?? `Herramienta ${t.name} de ${this.config.id}`,
              esquema: jsonSchemaAZod(t.inputSchema),
              esquemaJson: t.inputSchema,
              riesgoso: t.riesgoso ?? false,
              motivoRiesgo: t.motivoRiesgo,
            }))

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
            `No se pudo arrancar servidor MCP '${this.config.id}': ${mensaje}`,
          ),
        )
      }
    })
  }

  public async llamarHerramienta(
    nombre: string,
    argumentos: Record<string, unknown>,
  ): Promise<string> {
    if (!this.estaConectado()) {
      await this.conectar()
    }

    const res = (await this.enviarPeticion('tools/call', {
      name: nombre,
      arguments: argumentos,
    })) as {
      content?: Array<{ type: string; text?: string }>
      isError?: boolean
    }

    if (res.isError) {
      const errTexto =
        res.content?.map((c) => c.text ?? '').join('\n') ||
        'Error en herramienta MCP'
      throw new Error(errTexto)
    }

    return res.content?.map((c) => c.text ?? '').join('\n') ?? ''
  }

  public desconectar(): void {
    this.desconectado = true
    this.conectado = false
    if (this.lineReader) {
      this.lineReader.close()
      this.lineReader = null
    }
    if (this.proceso) {
      try {
        this.proceso.kill()
      } catch {
        // Ignorar fallo al matar proceso ya cerrado
      }
      this.proceso = null
    }
  }

  private enviarNotificacion(
    metodo: string,
    params: Record<string, unknown>,
  ): void {
    if (!this.proceso?.stdin?.writable) return
    const msg = JSON.stringify({
      jsonrpc: '2.0',
      method: metodo,
      params,
    })
    this.proceso.stdin.write(`${msg}\n`)
  }

  private enviarPeticion(
    metodo: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.proceso?.stdin?.writable) {
        reject(
          new Error(
            `Servidor MCP '${this.config.id}' no está listo para escribir`,
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
            `Timeout de respuesta de servidor MCP '${this.config.id}' para método ${metodo}`,
          ),
        )
      }, timeoutMs)

      this.respuestasPendientes.set(id, { resolve, reject, timer })

      const msg = JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: metodo,
        params,
      })
      this.proceso.stdin.write(`${msg}\n`)
    })
  }

  private procesarMensaje(linea: string): void {
    const texto = linea.trim()
    if (!texto) return
    try {
      const parsed = JSON.parse(texto) as {
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
              new Error(parsed.error.message ?? 'Error devuelto por MCP'),
            )
          } else {
            pendiente.resolve(parsed.result)
          }
        }
      }
    } catch {
      // Ignorar líneas no JSON (e.g. logs en stdout)
    }
  }
}

function jsonSchemaAZod(schema?: Record<string, unknown>): z.ZodTypeAny {
  if (!schema) return z.record(z.string(), z.unknown())
  // Esquema genérico permisivo o basado en tipo
  return z.object({}).passthrough()
}
