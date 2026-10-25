import { exec, spawn } from 'node:child_process'
import type { EntradaHerramienta } from '../core/registry.js'
import { truncarContenido } from './truncate.js'

export const COMANDOS_BLOQUEADOS_UNIX = new Set([
  'rm',
  'rmdir',
  'unlink',
  'shred',
  'mkfs',
  'dd',
  'chmod',
  'chown',
  'chgrp',
  'sudo',
  'su',
  'doas',
  'mount',
  'umount',
  'kill',
  'killall',
  'pkill',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
])

export const CATALOGO_COMANDOS_UNIX = new Set([
  'git',
  'npm',
  'node',
  'npx',
  'vitest',
  'echo',
  'cat',
  'ls',
  'grep',
  'find',
  'pwd',
  'mkdir',
  'cp',
  'mv',
  'head',
  'tail',
  'which',
  'diff',
  'cargo',
  'python',
  'python3',
  'pytest',
  'go',
  'bash',
  'sh',
])

/**
 * Catálogo de Windows. No incluye alias de borrado: la defensa es la allowlist,
 * porque una lista negra por nombre no aguanta los alias de PowerShell.
 */
export const CATALOGO_COMANDOS_WINDOWS = new Set([
  'git',
  'npm',
  'node',
  'npx',
  'vitest',
  'cargo',
  'python',
  'py',
  'go',
  'get-childitem',
  'get-content',
  'select-string',
  'get-location',
  'new-item',
  'copy-item',
  'move-item',
  'test-path',
  'resolve-path',
  'get-command',
  'write-output',
  'measure-object',
  'compare-object',
])

export const COMANDOS_BLOQUEADOS_WINDOWS = new Set<string>()

export interface OpcionesShell {
  plataforma?: NodeJS.Platform | undefined
  directorioProyecto?: string | undefined
  maximoContenido?: number | undefined
  ejecutor?:
    | ((
        comando: string,
        cwd: string,
      ) => Promise<{ salida: string; codigoSalida: number }>)
    | undefined
}

const OPERADORES_DE_COMPOSICION = /[;\n\r`&|]/

const COMILLAS = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'/g

export function extraerNombreBinario(comandoCompleto: string): string {
  const recortado = comandoCompleto.trim()
  const entreComillas =
    /^"([^"]+)"/.exec(recortado) ?? /^'([^']+)'/.exec(recortado)
  const primerToken = entreComillas?.[1] ?? recortado.split(/\s+/)[0] ?? ''
  const partes = primerToken.split(/[/\\]/)
  const nombre = partes[partes.length - 1] ?? ''
  return nombre.replace(/\.exe$/i, '').toLowerCase()
}

/**
 * Rechaza encadenamientos y subexpresiones fuera de comillas. La regla es la
 * misma en todas las plataformas: una invocación simple, sin `;`, `&&`, `|`,
 * backtick ni `$()`.
 */
export function contieneComposicion(comando: string): boolean {
  const sinComillas = comando.replace(COMILLAS, '')
  return (
    OPERADORES_DE_COMPOSICION.test(sinComillas) || sinComillas.includes('$(')
  )
}

function validarComando(
  comando: string,
  catalogo: Set<string>,
  bloqueados: Set<string>,
  plataforma: NodeJS.Platform,
): string | undefined {
  if (!comando) {
    return 'ERROR: el comando está vacío.'
  }

  if (contieneComposicion(comando)) {
    return "ERROR: la herramienta solo admite una invocación simple. No se permite encadenar comandos con ';', '&&', '||', '|', '&', '`' ni '$()'."
  }

  const nombreBinario = extraerNombreBinario(comando)

  if (bloqueados.has(nombreBinario)) {
    return `ERROR: El comando '${nombreBinario}' pertenece a la lista negra de comandos restringidos y no se puede ejecutar.`
  }

  if (!catalogo.has(nombreBinario)) {
    return `ERROR: El comando '${nombreBinario}' no está disponible en el catálogo de comandos de la plataforma '${plataforma}'.`
  }

  return undefined
}

function ejecutarPowershell(
  comando: string,
  cwd: string,
): Promise<{ salida: string; codigoSalida: number }> {
  return new Promise((resolve) => {
    const proceso = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', comando],
      { cwd, windowsHide: true },
    )

    let salida = ''
    proceso.stdout.on('data', (dato: Buffer) => {
      salida += dato.toString()
    })
    proceso.stderr.on('data', (dato: Buffer) => {
      salida += dato.toString()
    })
    proceso.on('error', (error) => {
      resolve({
        salida: `ERROR: no se pudo iniciar PowerShell: ${error.message}`,
        codigoSalida: 1,
      })
    })
    proceso.on('close', (codigo) => {
      resolve({ salida, codigoSalida: codigo ?? 0 })
    })
  })
}

function ejecutarEnUnix(
  comando: string,
  cwd: string,
): Promise<{ salida: string; codigoSalida: number }> {
  return new Promise((resolve) => {
    exec(
      comando,
      { cwd, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const salida = `${stdout}${stderr}`.trim()
        resolve({
          salida,
          codigoSalida:
            error && typeof error.code === 'number' ? error.code : 0,
        })
      },
    )
  })
}

export function crearHerramientaShell(
  opciones: OpcionesShell = {},
): EntradaHerramienta | undefined {
  const plataforma = opciones.plataforma ?? process.platform
  const cwd = opciones.directorioProyecto ?? process.cwd()
  const esWindows = plataforma === 'win32'

  const catalogo = esWindows
    ? CATALOGO_COMANDOS_WINDOWS
    : CATALOGO_COMANDOS_UNIX
  const bloqueados = esWindows
    ? COMANDOS_BLOQUEADOS_WINDOWS
    : COMANDOS_BLOQUEADOS_UNIX

  return {
    nombre: 'shell',
    descripcion: esWindows
      ? 'Ejecuta una invocación simple de un comando permitido del catálogo de Windows con PowerShell. No admite encadenar comandos.'
      : 'Ejecuta una invocación simple de un comando permitido del catálogo en el intérprete del sistema.',
    esquema: {
      type: 'object',
      properties: {
        comando: {
          type: 'string',
          description:
            'Línea de comando a ejecutar. Solo una invocación, sin ; && || | ni $().',
        },
      },
      required: ['comando'],
    },
    accionPermiso: 'shell',
    obtenerRecurso: (args) => String(args.comando ?? '').trim(),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const comando = String(args.comando ?? '').trim()
      const rechazo = validarComando(comando, catalogo, bloqueados, plataforma)
      if (rechazo) return rechazo

      const resultado = opciones.ejecutor
        ? await opciones.ejecutor(comando, cwd)
        : esWindows
          ? await ejecutarPowershell(comando, cwd)
          : await ejecutarEnUnix(comando, cwd)

      if (resultado.codigoSalida !== 0) {
        return `Comando terminó con código ${resultado.codigoSalida}.\nSalida:\n${resultado.salida}`
      }

      const salida = opciones.ejecutor
        ? resultado.salida
        : resultado.salida.trim()
      return truncarContenido(salida, opciones.maximoContenido)
    },
  }
}
