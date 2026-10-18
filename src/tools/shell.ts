import { exec } from 'node:child_process'
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

function extraerNombreBinario(comandoCompleto: string): string {
  const recortado = comandoCompleto.trim()
  const primerToken = recortado.split(/\s+/)[0] ?? ''
  // Si incluye ruta (/bin/rm -> rm), extraer el nombre base
  const partes = primerToken.split('/')
  return partes[partes.length - 1] ?? ''
}

export function crearHerramientaShell(
  opciones: OpcionesShell = {},
): EntradaHerramienta | undefined {
  const plataforma = opciones.plataforma ?? process.platform
  const cwd = opciones.directorioProyecto ?? process.cwd()

  // En Windows la herramienta no está disponible en la v1
  if (plataforma === 'win32') {
    return undefined
  }

  return {
    nombre: 'bash',
    descripcion:
      'Ejecuta un comando permitido del catálogo en el intérprete de comandos del sistema.',
    esquema: {
      type: 'object',
      properties: {
        comando: {
          type: 'string',
          description: 'Línea de comando a ejecutar',
        },
      },
      required: ['comando'],
    },
    ejecutar: async (args) => {
      const comando = String(args.comando ?? '').trim()
      const nombreBinario = extraerNombreBinario(comando)

      // 1. Verificar lista negra por nombre completo
      if (COMANDOS_BLOQUEADOS_UNIX.has(nombreBinario)) {
        return `ERROR: El comando '${nombreBinario}' pertenece a la lista negra de comandos restringidos y no se puede ejecutar.`
      }

      // 2. Verificar catálogo de la plataforma
      if (!CATALOGO_COMANDOS_UNIX.has(nombreBinario)) {
        return `ERROR: El comando '${nombreBinario}' no está disponible en el catálogo de comandos de la plataforma '${plataforma}'.`
      }

      // 3. Ejecutar comando
      if (opciones.ejecutor) {
        const res = await opciones.ejecutor(comando, cwd)
        if (res.codigoSalida !== 0) {
          return `Comando terminó con código ${res.codigoSalida}.\nSalida:\n${res.salida}`
        }
        return truncarContenido(res.salida, opciones.maximoContenido)
      }

      return new Promise<string>((resolve) => {
        exec(
          comando,
          { cwd, maxBuffer: 10 * 1024 * 1024 },
          (error, stdout, stderr) => {
            const salidaCombinada = `${stdout}${stderr}`.trim()
            if (error && typeof error.code === 'number') {
              resolve(
                `Comando terminó con código ${error.code}.\nSalida:\n${salidaCombinada}`,
              )
              return
            }
            resolve(truncarContenido(salidaCombinada, opciones.maximoContenido))
          },
        )
      })
    },
  }
}
