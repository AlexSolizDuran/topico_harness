import { formatearColaSalida } from '../tools/truncate.js'
import { ClienteMcp } from './cliente.js'
import type { ConfiguracionServidorMcp, HerramientaMcp } from './types.js'

export interface OpcionesGestorMcp {
  servidores?: ConfiguracionServidorMcp[] | undefined
  timeoutMs?: number | undefined
  maxBytesSalida?: number | undefined
  sanitizarCredenciales?: ((texto: string) => string) | undefined
}

export class GestorMcp {
  private servidoresConfig = new Map<string, ConfiguracionServidorMcp>()
  private clientes = new Map<string, ClienteMcp>()
  private herramientasConectadas: HerramientaMcp[] = []
  private intentosFallidos = new Set<string>()

  constructor(private readonly opciones: OpcionesGestorMcp = {}) {
    for (const s of opciones.servidores ?? []) {
      this.validarConfiguracionServidor(s)
      this.servidoresConfig.set(s.id, s)
    }
  }

  public validarConfiguracionServidor(s: ConfiguracionServidorMcp): void {
    if (!s.id?.trim()) {
      throw new Error("Servidor MCP no declara identificador 'id'")
    }
    if (!s.comando?.trim()) {
      throw new Error(`Servidor MCP '${s.id}' no declara comando de arranque`)
    }
    // Las variables de entorno se declaran por nombre; nunca como valor literal.
    for (const nombre of s.env ?? []) {
      if (
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(nombre) ||
        /^(sk-|ghp_|github_pat_|xox[baprs]-|bearer\s)/i.test(nombre)
      ) {
        throw new Error(
          `Configuración de servidor MCP '${s.id}' contiene secreto literal en variable '${nombre}'`,
        )
      }
    }
  }

  public obtenerHerramientasVisibles(
    servidoresPermitidos?: string[],
  ): HerramientaMcp[] {
    if (!servidoresPermitidos || servidoresPermitidos.length === 0) {
      return []
    }
    const permitidos = new Set(servidoresPermitidos)
    return this.herramientasConectadas.filter((h) => permitidos.has(h.servidor))
  }

  public async conectarServidor(id: string): Promise<void> {
    const config = this.servidoresConfig.get(id)
    if (!config) {
      throw new Error(`Servidor MCP '${id}' no está configurado`)
    }

    let cliente = this.clientes.get(id)
    if (!cliente) {
      cliente = new ClienteMcp(config, {
        timeoutMs: this.opciones.timeoutMs,
        sanitizarCredenciales: this.opciones.sanitizarCredenciales,
      })
      this.clientes.set(id, cliente)
    }

    try {
      await cliente.conectar()
      this.intentosFallidos.delete(id)
      const nuevasHerramientas = cliente.obtenerHerramientas()
      // Agregar al final sin alterar las existentes (orden estable)
      for (const h of nuevasHerramientas) {
        if (
          !this.herramientasConectadas.some(
            (existente) => existente.nombreCompleto === h.nombreCompleto,
          )
        ) {
          this.herramientasConectadas.push(h)
        }
      }
    } catch (err) {
      this.intentosFallidos.add(id)
      throw err
    }
  }

  private async asegurarCliente(
    servidorId: string,
  ): Promise<{ cliente?: ClienteMcp | undefined; error?: string | undefined }> {
    let cliente = this.clientes.get(servidorId)
    if (!cliente?.estaConectado()) {
      try {
        await this.conectarServidor(servidorId)
        cliente = this.clientes.get(servidorId)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          error: `ERROR: No se pudo conectar al servidor MCP '${servidorId}': ${msg}`,
        }
      }
    }
    return { cliente }
  }

  public async ejecutarHerramienta(
    nombreCompleto: string,
    argumentos: Record<string, unknown>,
  ): Promise<string> {
    const separador = nombreCompleto.indexOf('_')
    if (separador === -1) {
      return `ERROR: Herramienta '${nombreCompleto}' no tiene prefijo de servidor MCP válido.`
    }
    const servidorId = nombreCompleto.slice(0, separador)
    const nombreOriginal = nombreCompleto.slice(separador + 1)

    const asegurado = await this.asegurarCliente(servidorId)
    if (asegurado.error || !asegurado.cliente) {
      return (
        asegurado.error ?? `ERROR: Servidor MCP '${servidorId}' no disponible.`
      )
    }

    const herramienta = this.herramientasConectadas.find(
      (h) => h.nombreCompleto === nombreCompleto,
    )
    if (herramienta) {
      const resultadoValidacion = herramienta.esquema.safeParse(argumentos)
      if (!resultadoValidacion.success) {
        return `ERROR: Los argumentos no cumplen el esquema de la herramienta '${nombreCompleto}': ${resultadoValidacion.error.message}`
      }
    }

    try {
      let salida = await asegurado.cliente.llamarHerramienta(
        nombreOriginal,
        argumentos,
      )

      if (this.opciones.sanitizarCredenciales) {
        salida = this.opciones.sanitizarCredenciales(salida)
      }

      const maxBytes = this.opciones.maxBytesSalida ?? 64 * 1024
      const formateado = formatearColaSalida(salida, maxBytes)
      return formateado.cola
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      return `ERROR: Falló la herramienta MCP '${nombreCompleto}': ${msg}`
    }
  }

  public cerrar(): void {
    for (const cliente of this.clientes.values()) {
      if (typeof cliente.desconectar === 'function') {
        cliente.desconectar()
      }
    }
    this.clientes.clear()
    this.herramientasConectadas = []
  }
}
