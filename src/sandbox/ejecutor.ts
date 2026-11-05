import { spawn } from 'node:child_process'
import { determinarMecanismoAislamiento } from './plataforma.js'
import { GestorTemporalesSandbox } from './temporales.js'
import type {
  InformacionAislamiento,
  OpcionesEjecucionAislada,
  ResultadoEjecucionAislada,
} from './types.js'

export class EjecutorSandbox {
  private gestorTemporales = new GestorTemporalesSandbox()

  public async ejecutarComando(
    opciones: OpcionesEjecucionAislada,
  ): Promise<ResultadoEjecucionAislada> {
    const aislamiento = determinarMecanismoAislamiento(opciones.config)
    const dirTemporal = this.gestorTemporales.crearTemporal()
    aislamiento.directorioTemporal = dirTemporal

    try {
      const resultado = await this.ejecutarProceso(
        opciones,
        aislamiento,
        dirTemporal,
      )
      return resultado
    } finally {
      // Limpiar temporal al finalizar la ejecución
      this.gestorTemporales.limpiar(dirTemporal)
    }
  }

  public cerrar(): void {
    this.gestorTemporales.limpiarTodos()
  }

  public ejecutarProceso(
    opciones: OpcionesEjecucionAislada,
    aislamiento: InformacionAislamiento,
    dirTemporal: string,
  ): Promise<ResultadoEjecucionAislada> {
    return new Promise((resolve) => {
      let comandoEjecutable = opciones.comando
      let argsEjecutable = opciones.args ?? []

      if (aislamiento.aislado && aislamiento.mecanismo === 'bwrap') {
        // Envoltorio bubblewrap: raíz read-only, bind en proyecto y temporal
        comandoEjecutable = 'bwrap'
        argsEjecutable = [
          '--ro-bind',
          '/',
          '/',
          '--bind',
          opciones.directorioProyecto,
          opciones.directorioProyecto,
          '--bind',
          dirTemporal,
          dirTemporal,
          '--',
          opciones.comando,
          ...(opciones.args ?? []),
        ]
      } else if (
        aislamiento.aislado &&
        aislamiento.mecanismo === 'sandbox-exec'
      ) {
        // Envoltorio sandbox-exec de macOS
        comandoEjecutable = 'sandbox-exec'
        const perfil = `(version 1)(deny default)(allow file-read*)(allow file-write* (subpath "${opciones.directorioProyecto}"))(allow file-write* (subpath "${dirTemporal}"))(allow process-exec)`
        argsEjecutable = [
          '-p',
          perfil,
          opciones.comando,
          ...(opciones.args ?? []),
        ]
      }

      try {
        const proc = spawn(comandoEjecutable, argsEjecutable, {
          cwd: opciones.directorioProyecto,
          env: {
            ...process.env,
            ...opciones.env,
            TMPDIR: dirTemporal,
            TEMP: dirTemporal,
            TMP: dirTemporal,
          },
          shell: !aislamiento.aislado && process.platform === 'win32',
        })

        let stdout = ''
        let stderr = ''

        proc.stdout?.on('data', (d) => {
          stdout += d.toString('utf8')
        })

        proc.stderr?.on('data', (d) => {
          stderr += d.toString('utf8')
        })

        proc.on('error', (err) => {
          // Un error del comando o sandbox vuelve como texto. Si el mecanismo
          // no arrancó, el resultado no puede presentarse como aislado.
          const msg = `ERROR de ejecución: ${err.message}`
          resolve({
            codigoSalida: 1,
            stdout,
            stderr: stderr ? `${stderr}\n${msg}` : msg,
            aislamiento: aislamiento.aislado
              ? {
                  aislado: false,
                  motivoDegradacion: `No se pudo iniciar el mecanismo '${aislamiento.mecanismo ?? 'de aislamiento'}': ${err.message}`,
                }
              : aislamiento,
          })
        })

        proc.on('close', (codigo) => {
          resolve({
            codigoSalida: codigo ?? 0,
            stdout,
            stderr,
            aislamiento,
          })
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        resolve({
          codigoSalida: 1,
          stdout: '',
          stderr: `ERROR al invocar sandbox: ${msg}`,
          aislamiento,
        })
      }
    })
  }
}
