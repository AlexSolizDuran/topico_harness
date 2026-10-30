#!/usr/bin/env node
import { readFileSync, statSync } from 'node:fs'
import { construirHarness } from './app.js'
import { type Argumentos, AYUDA, parsearArgumentos } from './args.js'
import {
  formatearAvisoSesion,
  RenderizadorLineaALinea,
  RenderizadorProgreso,
} from './interface/plain.js'
import { detectarTerminalInteractiva } from './interface/runner.js'

type Sesion = ReturnType<typeof construirHarness>['sesion']

function validarDirectorio(directorio: string): boolean {
  try {
    return statSync(directorio).isDirectory()
  } catch {
    return false
  }
}

function leerEntradaEstandar(): string {
  try {
    return readFileSync(0, 'utf-8').trim()
  } catch {
    return ''
  }
}

function prepararSesion(
  args: Argumentos,
  directorio: string,
  esInteractivo: boolean,
): { sesion: Sesion } | { error: string } {
  try {
    if (args.ramaDe !== undefined) {
      if (
        args.desde === undefined ||
        !Number.isInteger(args.desde) ||
        args.desde < 0
      ) {
        return {
          error:
            'La opción --rama-de requiere --desde <n> con un turno entero mayor o igual que cero.',
        }
      }
      if (args.sinSesion) {
        return {
          error: 'No se puede combinar --rama-de con --sin-sesion.',
        }
      }
    }

    const { sesion } = construirHarness({
      directorioProyecto: directorio,
      esInteractivo,
      guardarSesiones: !args.sinSesion,
      ...(args.continuar ? { continuar: true } : {}),
      ...(args.sesion ? { sesionId: args.sesion } : {}),
      ...(args.ramaDe ? { ramaDe: args.ramaDe } : {}),
      ...(args.desde !== undefined ? { desde: args.desde } : {}),
    })
    if (args.modelo) {
      sesion.cambiarModelo(args.modelo)
    }
    if (args.agente) {
      sesion.cambiarAgente(args.agente)
    }
    return { sesion }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function ejecutarEnPlano(sesion: Sesion, pedido: string): Promise<void> {
  const renderizador = new RenderizadorLineaALinea()
  const progreso = new RenderizadorProgreso(renderizador)
  sesion.establecerActualizador((estado) => progreso.actualizar(estado))
  await sesion.enviarMensaje(pedido)
}

async function ejecutarPedido(
  sesion: Sesion,
  pedido: string,
  interactivo: boolean,
  directorio: string,
): Promise<number> {
  if (!interactivo) {
    process.stdout.write(formatearAvisoSesion(sesion.obtenerSesionId()))
  }

  if (interactivo && !pedido) {
    const { renderizarInteractivo } = await import('./interface/render.js')
    const instancia = renderizarInteractivo(sesion, { directorio })
    await instancia.waitUntilExit()
    await sesion.cerrarSesion()
  } else if (pedido) {
    await ejecutarEnPlano(sesion, pedido)
    await sesion.cerrarSesion()
  } else {
    await sesion.cerrarSesion()
    process.stderr.write(
      'No se recibió ningún pedido. Usá --help para ver las opciones.\n',
    )
    return 1
  }

  return sesion.obtenerUltimoTurno()?.tipo === 'fallido' ? 1 : 0
}

async function main(): Promise<number> {
  const args = parsearArgumentos(process.argv.slice(2))

  if (args.ayuda) {
    process.stdout.write(`${AYUDA}\n`)
    return 0
  }

  const directorio = args.directorio ?? process.cwd()
  if (!validarDirectorio(directorio)) {
    process.stderr.write(`ERROR: el directorio no existe: ${directorio}\n`)
    return 1
  }

  const pedido =
    args.pedido || (process.stdin.isTTY ? '' : leerEntradaEstandar())
  const interactivo =
    detectarTerminalInteractiva(process.stdout) &&
    Boolean(process.stdin.isTTY) &&
    !pedido

  const preparado = prepararSesion(args, directorio, interactivo)
  if ('error' in preparado) {
    process.stderr.write(`ERROR: ${preparado.error}\n`)
    return 1
  }

  return ejecutarPedido(preparado.sesion, pedido, interactivo, directorio)
}

main()
  .then((codigo) => {
    process.exitCode = codigo
  })
  .catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : String(error)
    process.stderr.write(`ERROR: ${mensaje}\n`)
    process.exitCode = 1
  })
