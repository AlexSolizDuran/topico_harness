import { spawn, spawnSync } from 'node:child_process'
import { sanitizarTexto } from '../provider/credentials.js'
import type {
  ContextoHook,
  EjecutorHooks,
  EventoHook,
  PorteroPermisos,
  ResultadoEjecucionHook,
} from '../types.js'

export const EVENTOS_HOOK_VALIDOS: readonly EventoHook[] = [
  'sessionStart',
  'sessionEnd',
  'preTool',
  'postTool',
  'turnEnd',
]

export const TIMEOUT_HOOK_DEFECTO_MS = 30_000
export const MAXIMO_BYTES_SALIDA_HOOK = 8 * 1024
export const MARCADOR_SALIDA_HOOK_TRUNCADA =
  '\n... [Salida de hook truncada a 8 KiB]'

export interface DefinicionHook {
  comando: string
  match?: string | undefined
  timeoutMs?: number | undefined
}

export type ConfiguracionHooks = Partial<Record<EventoHook, DefinicionHook[]>>

export interface ResultadoProcesoHook {
  codigo: number | null
  stdout: string
  stderr: string
  expirado?: boolean | undefined
  errorEjecucion?: string | undefined
}

export type EjecutorComandoHook = (
  comando: string,
  entradaJson: string,
  opciones: { cwd: string; timeoutMs: number },
) => Promise<ResultadoProcesoHook>

export interface OpcionesGestorHooks {
  hooks?: ConfiguracionHooks | undefined
  directorioProyecto: string
  portero?: PorteroPermisos | undefined
  credenciales?: readonly string[] | undefined
  timeoutMs?: number | undefined
  soloHerramientas?: boolean | undefined
  ejecutorComando?: EjecutorComandoHook | undefined
}

export class ErrorBloqueoHook extends Error {
  readonly evento: EventoHook
  constructor(evento: EventoHook, mensaje: string) {
    super(mensaje)
    this.name = 'ErrorBloqueoHook'
    this.evento = evento
  }
}

export function truncarYSanitizarSalidaHook(
  texto: string,
  credenciales: readonly string[] = [],
): string {
  const sanitizado = sanitizarTexto(texto.trim(), [...credenciales])
  const buffer = Buffer.from(sanitizado, 'utf8')
  if (buffer.byteLength <= MAXIMO_BYTES_SALIDA_HOOK) {
    return sanitizado
  }
  const recorte = buffer.subarray(0, MAXIMO_BYTES_SALIDA_HOOK).toString('utf8')
  return `${recorte}${MARCADOR_SALIDA_HOOK_TRUNCADA}`
}

export function construirPayloadHook(
  contexto: ContextoHook,
  directorioProyecto: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    evento: contexto.evento,
    proyecto: directorioProyecto,
  }

  if (contexto.evento === 'preTool' || contexto.evento === 'postTool') {
    if (contexto.herramienta !== undefined) {
      payload.herramienta = contexto.herramienta
    }
    if (contexto.argumentos !== undefined) {
      payload.argumentos = contexto.argumentos
    }
  }

  if (contexto.evento === 'postTool' && contexto.resultado !== undefined) {
    payload.resultado = contexto.resultado
  }

  return payload
}

export function ejecutarProcesoHookSincrono(
  comando: string,
  entradaJson: string,
  opciones: { cwd: string; timeoutMs: number },
): ResultadoProcesoHook {
  const partes = comando.trim().split(/\s+/)
  const ejecutable = partes[0] ?? comando
  const usarShell =
    /[|&;<>()$`\\"'*\n]/.test(comando) ||
    partes.length > 1 ||
    process.platform === 'win32'

  const res = usarShell
    ? spawnSync(comando, {
        cwd: opciones.cwd,
        shell: true,
        input: entradaJson,
        encoding: 'utf8',
        timeout: opciones.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      })
    : spawnSync(ejecutable, partes.slice(1), {
        cwd: opciones.cwd,
        shell: false,
        input: entradaJson,
        encoding: 'utf8',
        timeout: opciones.timeoutMs,
        maxBuffer: 16 * 1024 * 1024,
      })

  const stdout = typeof res.stdout === 'string' ? res.stdout : ''
  const stderr = typeof res.stderr === 'string' ? res.stderr : ''

  if (res.error) {
    const codigoErr = (res.error as NodeJS.ErrnoException).code
    if (codigoErr === 'ETIMEDOUT') {
      return { codigo: null, stdout, stderr, expirado: true }
    }
    return {
      codigo: null,
      stdout,
      stderr,
      errorEjecucion: res.error.message,
    }
  }

  return {
    codigo: res.status,
    stdout,
    stderr,
  }
}

export function ejecutarProcesoHookPorDefecto(
  comando: string,
  entradaJson: string,
  opciones: { cwd: string; timeoutMs: number },
): Promise<ResultadoProcesoHook> {
  return new Promise((resolve) => {
    const partes = comando.trim().split(/\s+/)
    const ejecutable = partes[0] ?? comando
    const usarShell =
      /[|&;<>()$`\\"'*\n]/.test(comando) ||
      partes.length > 1 ||
      process.platform === 'win32'

    let finalizado = false
    let expirado = false
    let stdout = ''
    let stderr = ''

    const child = usarShell
      ? spawn(comando, {
          cwd: opciones.cwd,
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe'],
        })
      : spawn(ejecutable, partes.slice(1), {
          cwd: opciones.cwd,
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
        })

    const timer = setTimeout(() => {
      if (finalizado) return
      expirado = true
      finalizado = true
      try {
        child.kill('SIGKILL')
      } catch {
        // Ignorar fallo al matar proceso ya cerrado
      }
      resolve({
        codigo: null,
        stdout,
        stderr,
        expirado: true,
      })
    }, opciones.timeoutMs)

    child.stdout?.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString()
    })

    child.stderr?.on('data', (chunk: Buffer | string) => {
      stderr += chunk.toString()
    })

    child.on('error', (err) => {
      if (finalizado) return
      finalizado = true
      clearTimeout(timer)
      resolve({
        codigo: null,
        stdout,
        stderr,
        errorEjecucion: err.message,
      })
    })

    child.on('close', (codigo) => {
      if (finalizado || expirado) return
      finalizado = true
      clearTimeout(timer)
      resolve({
        codigo,
        stdout,
        stderr,
      })
    })

    if (child.stdin) {
      child.stdin.on('error', () => {
        // Ignorar EPIPE si el comando cierra stdin temprano
      })
      child.stdin.end(entradaJson, 'utf8')
    }
  })
}

function coincideMatchHook(
  patron: string | undefined,
  herramienta: string | undefined,
): boolean {
  if (!patron) return true
  if (!herramienta) return false
  return new RegExp(patron).test(herramienta)
}

function esEventoDeHerramienta(evento: EventoHook): boolean {
  return evento === 'preTool' || evento === 'postTool'
}

function puedeBloquearEvento(evento: EventoHook): boolean {
  return (
    evento === 'preTool' || evento === 'postTool' || evento === 'sessionStart'
  )
}

export class GestorHooks implements EjecutorHooks {
  private readonly hooks: ConfiguracionHooks
  private readonly directorioProyecto: string
  private readonly portero?: PorteroPermisos | undefined
  private readonly credenciales: readonly string[]
  private readonly timeoutMs: number
  private readonly soloHerramientas: boolean
  private readonly ejecutorComando: EjecutorComandoHook

  constructor(opciones: OpcionesGestorHooks) {
    this.hooks = opciones.hooks ?? {}
    this.directorioProyecto = opciones.directorioProyecto
    this.portero = opciones.portero
    this.credenciales = opciones.credenciales ?? []
    this.timeoutMs = opciones.timeoutMs ?? TIMEOUT_HOOK_DEFECTO_MS
    this.soloHerramientas = opciones.soloHerramientas ?? false
    this.ejecutorComando =
      opciones.ejecutorComando ?? ejecutarProcesoHookPorDefecto
  }

  tieneHooksConfigurados(): boolean {
    return Object.values(this.hooks).some(
      (lista) => Array.isArray(lista) && lista.length > 0,
    )
  }

  paraSubagente(porteroSubagente?: PorteroPermisos | undefined): GestorHooks {
    return new GestorHooks({
      hooks: this.hooks,
      directorioProyecto: this.directorioProyecto,
      portero: porteroSubagente ?? this.portero,
      credenciales: this.credenciales,
      timeoutMs: this.timeoutMs,
      soloHerramientas: true,
      ejecutorComando: this.ejecutorComando,
    })
  }

  private async verificarPermisoHook(
    evento: EventoHook,
    comando: string,
  ): Promise<{ permitido: boolean; aviso?: string }> {
    if (!this.portero) {
      return { permitido: true }
    }

    const evaluacion = this.portero.evaluar(
      {
        nombre: 'hook',
        accionPermiso: 'hook',
        obtenerRecurso: () => evento,
      },
      { evento },
    )
    if (evaluacion.efecto === 'denegar') {
      return {
        permitido: false,
        aviso: `Hook omitido por regla denegar en ${evento}: ${comando}`,
      }
    }

    if (evaluacion.efecto === 'consultar') {
      if (!this.portero.solicitarAprobacion) {
        return {
          permitido: false,
          aviso: `Hook omitido por falta de aprobación interactiva en ${evento}: ${comando}`,
        }
      }
      const decision = await this.portero.solicitarAprobacion({
        id: `hook-${evento}`,
        accion: 'hook',
        recurso: evento,
        herramienta: 'hook',
        patronSugerido: evento,
        obligatoria: evaluacion.obligatoria,
        motivo: `Ejecutar hook ${evento}: ${comando}`,
      })
      if (decision === 'denegar') {
        return {
          permitido: false,
          aviso: `Hook omitido por aprobación denegada en ${evento}: ${comando}`,
        }
      }
    }

    return { permitido: true }
  }

  private procesarResultadoProceso(
    evento: EventoHook,
    comando: string,
    resultado: ResultadoProcesoHook,
    timeoutAplicado: number,
    notas: string[],
    avisos: string[],
  ): { bloqueado: boolean; mensajeBloqueo?: string } {
    if (resultado.expirado) {
      const msgTimeout = truncarYSanitizarSalidaHook(
        `Hook en ${evento} excedió el timeout de ${timeoutAplicado}ms (${comando})`,
        this.credenciales,
      )
      avisos.push(msgTimeout)
      if (esEventoDeHerramienta(evento)) {
        notas.push(msgTimeout)
      }
      return { bloqueado: false }
    }

    if (resultado.errorEjecucion) {
      const msgError = truncarYSanitizarSalidaHook(
        `No se pudo ejecutar el hook en ${evento} (${comando}): ${resultado.errorEjecucion}`,
        this.credenciales,
      )
      avisos.push(msgError)
      if (esEventoDeHerramienta(evento)) {
        notas.push(msgError)
      }
      return { bloqueado: false }
    }

    const salidaBruta =
      resultado.stdout.trim().length > 0 ? resultado.stdout : resultado.stderr
    const salidaLimpia = truncarYSanitizarSalidaHook(
      salidaBruta,
      this.credenciales,
    )

    if (resultado.codigo === 0) {
      return { bloqueado: false }
    }

    if (resultado.codigo === 2) {
      const msgBloqueo =
        salidaLimpia || `Operación bloqueada por hook en ${evento}.`
      if (puedeBloquearEvento(evento)) {
        return { bloqueado: true, mensajeBloqueo: msgBloqueo }
      }
      avisos.push(msgBloqueo)
      return { bloqueado: false }
    }

    // Código 1 o cualquier otro código inesperado se trata como aviso/nota
    const msgAviso =
      salidaLimpia ||
      `Hook en ${evento} finalizó con código ${String(resultado.codigo)} (${comando}).`
    avisos.push(msgAviso)
    if (esEventoDeHerramienta(evento)) {
      notas.push(msgAviso)
    }
    return { bloqueado: false }
  }

  async ejecutar(contexto: ContextoHook): Promise<ResultadoEjecucionHook> {
    if (this.soloHerramientas && !esEventoDeHerramienta(contexto.evento)) {
      return { bloqueado: false, notas: [], avisos: [] }
    }

    const lista = this.hooks[contexto.evento]
    if (!lista || lista.length === 0) {
      return { bloqueado: false, notas: [], avisos: [] }
    }

    const notas: string[] = []
    const avisos: string[] = []
    const entradaJson = JSON.stringify(
      construirPayloadHook(contexto, this.directorioProyecto),
    )

    for (const def of lista) {
      if (
        esEventoDeHerramienta(contexto.evento) &&
        !coincideMatchHook(def.match, contexto.herramienta)
      ) {
        continue
      }

      const permiso = await this.verificarPermisoHook(
        contexto.evento,
        def.comando,
      )
      if (!permiso.permitido) {
        if (permiso.aviso) {
          avisos.push(permiso.aviso)
        }
        continue
      }

      const timeoutAplicado = def.timeoutMs ?? this.timeoutMs
      let resultado: ResultadoProcesoHook
      try {
        resultado = await this.ejecutorComando(def.comando, entradaJson, {
          cwd: this.directorioProyecto,
          timeoutMs: timeoutAplicado,
        })
      } catch (err) {
        resultado = {
          codigo: null,
          stdout: '',
          stderr: '',
          errorEjecucion: err instanceof Error ? err.message : String(err),
        }
      }

      const decision = this.procesarResultadoProceso(
        contexto.evento,
        def.comando,
        resultado,
        timeoutAplicado,
        notas,
        avisos,
      )
      if (decision.bloqueado) {
        return {
          bloqueado: true,
          mensajeBloqueo: decision.mensajeBloqueo,
          notas,
          avisos,
        }
      }
    }

    return { bloqueado: false, notas, avisos }
  }

  ejecutarSincrono(contexto: ContextoHook): {
    resultado: ResultadoEjecucionHook
    requiereAprobacionAsync: boolean
  } {
    if (this.soloHerramientas && !esEventoDeHerramienta(contexto.evento)) {
      return {
        resultado: { bloqueado: false, notas: [], avisos: [] },
        requiereAprobacionAsync: false,
      }
    }

    const lista = this.hooks[contexto.evento]
    if (!lista || lista.length === 0) {
      return {
        resultado: { bloqueado: false, notas: [], avisos: [] },
        requiereAprobacionAsync: false,
      }
    }

    const notas: string[] = []
    const avisos: string[] = []
    const entradaJson = JSON.stringify(
      construirPayloadHook(contexto, this.directorioProyecto),
    )

    for (const def of lista) {
      if (
        esEventoDeHerramienta(contexto.evento) &&
        !coincideMatchHook(def.match, contexto.herramienta)
      ) {
        continue
      }

      if (this.portero) {
        const evaluacion = this.portero.evaluar(
          {
            nombre: 'hook',
            accionPermiso: 'hook',
            obtenerRecurso: () => contexto.evento,
          },
          { evento: contexto.evento },
        )
        if (evaluacion.efecto === 'denegar') {
          avisos.push(
            `Hook omitido por regla denegar en ${contexto.evento}: ${def.comando}`,
          )
          continue
        }
        if (evaluacion.efecto === 'consultar') {
          return {
            resultado: { bloqueado: false, notas, avisos },
            requiereAprobacionAsync: true,
          }
        }
      }

      const timeoutAplicado = def.timeoutMs ?? this.timeoutMs
      const proc = ejecutarProcesoHookSincrono(def.comando, entradaJson, {
        cwd: this.directorioProyecto,
        timeoutMs: timeoutAplicado,
      })

      const decision = this.procesarResultadoProceso(
        contexto.evento,
        def.comando,
        proc,
        timeoutAplicado,
        notas,
        avisos,
      )
      if (decision.bloqueado) {
        return {
          resultado: {
            bloqueado: true,
            mensajeBloqueo: decision.mensajeBloqueo,
            notas,
            avisos,
          },
          requiereAprobacionAsync: false,
        }
      }
    }

    return {
      resultado: { bloqueado: false, notas, avisos },
      requiereAprobacionAsync: false,
    }
  }
}
