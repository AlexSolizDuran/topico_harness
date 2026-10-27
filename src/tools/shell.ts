import { exec, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import type { EntradaHerramienta } from '../core/registry.js'
import { resolverRutaSegura } from './path.js'
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

/**
 * Banderas que convierten un intérprete en una ejecución de código arbitrario.
 * `bash -e` es errexit y no ejecuta código, por eso no está en la lista.
 */
const BANDERAS_DE_CODIGO: Record<string, readonly string[]> = {
  bash: ['-c'],
  sh: ['-c'],
  zsh: ['-c'],
  dash: ['-c'],
  node: ['-e', '--eval', '-p', '--print'],
  python: ['-c'],
  python3: ['-c'],
  perl: ['-e'],
  ruby: ['-e'],
  php: ['-r'],
}

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
 * Detecta encadenamientos y subexpresiones fuera de comillas. En Unix una línea
 * compuesta se valida segmento por segmento; en Windows es un rechazo directo.
 */
export function contieneComposicion(comando: string): boolean {
  const sinComillas = comando.replace(COMILLAS, '')
  return (
    OPERADORES_DE_COMPOSICION.test(sinComillas) || sinComillas.includes('$(')
  )
}

/**
 * `$()` y backticks ejecutan código que no se puede validar por segmento, así
 * que se rechazan siempre, incluso dentro de una línea compuesta.
 */
export function contieneSustitucion(comando: string): boolean {
  const sinComillas = comando.replace(COMILLAS, '')
  return sinComillas.includes('`') || sinComillas.includes('$(')
}

/**
 * Consume un bloque entre comillas, respetando los escapes de las comillas
 * dobles. Devuelve el texto tal cual y el índice del carácter siguiente.
 */
function avanzarComilla(
  comando: string,
  desde: number,
  comilla: '"' | "'",
): { texto: string; siguiente: number } {
  let texto = comando[desde] as string
  let i = desde + 1

  while (i < comando.length) {
    const caracter = comando[i] as string
    texto += caracter

    if (caracter === '\\' && comilla === '"' && i + 1 < comando.length) {
      texto += comando[i + 1]
      i += 2
      continue
    }

    if (caracter === comilla) return { texto, siguiente: i + 1 }
    i += 1
  }

  return { texto, siguiente: i }
}

/**
 * Parte la línea en invocaciones simples respetando comillas y escapes. Las
 * redirecciones (`2>&1`) se neutralizan porque no separan comandos.
 */
export function dividirSegmentos(comando: string): string[] {
  const normalizado = comando.replace(/\d*>&\d+/g, ' ')
  const segmentos: string[] = []
  let actual = ''
  let i = 0

  while (i < normalizado.length) {
    const caracter = normalizado[i] as string

    if (caracter === '"' || caracter === "'") {
      const bloque = avanzarComilla(normalizado, i, caracter)
      actual += bloque.texto
      i = bloque.siguiente
      continue
    }

    if (caracter === '\\') {
      const siguiente = normalizado[i + 1]
      actual += siguiente === undefined ? caracter : caracter + siguiente
      i += 2
      continue
    }

    if (caracter === ';' || caracter === '|' || caracter === '&') {
      segmentos.push(actual)
      actual = ''
      i += normalizado[i + 1] === caracter ? 2 : 1
      continue
    }

    actual += caracter
    i += 1
  }

  segmentos.push(actual)
  return segmentos.map((s) => s.trim()).filter((s) => s.length > 0)
}

function esInvocacionConCodigo(segmento: string): boolean {
  const banderas = BANDERAS_DE_CODIGO[extraerNombreBinario(segmento)]
  if (!banderas) return false
  const tokens = segmento.trim().split(/\s+/).slice(1)
  return tokens.some((token) => banderas.includes(token))
}

/**
 * Un comando es compuesto si encadena invocaciones o si ejecuta código a través
 * de un intérprete. En los dos casos la acción de permiso es `shell_compuesto`.
 */
export function esComandoCompuesto(comando: string): boolean {
  if (contieneComposicion(comando)) return true
  return dividirSegmentos(comando).some(esInvocacionConCodigo)
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

  if (contieneSustitucion(comando)) {
    return "ERROR: la herramienta no admite sustitución de comandos con '`' ni '$()'."
  }

  if (plataforma === 'win32' && contieneComposicion(comando)) {
    return "ERROR: en Windows la herramienta solo admite una invocación simple. No se permite encadenar comandos con ';', '&&', '||', '|' ni '&'."
  }

  const segmentos =
    plataforma === 'win32' ? [comando] : dividirSegmentos(comando)

  for (const segmento of segmentos) {
    const nombreBinario = extraerNombreBinario(segmento)

    if (bloqueados.has(nombreBinario)) {
      return `ERROR: El comando '${nombreBinario}' pertenece a la lista negra de comandos restringidos y no se puede ejecutar.`
    }

    if (!catalogo.has(nombreBinario)) {
      return `ERROR: El comando '${nombreBinario}' no está disponible en el catálogo de comandos de la plataforma '${plataforma}'.`
    }
  }

  return undefined
}

type ResultadoDirectorio =
  | { readonly ok: true; readonly ruta: string }
  | { readonly ok: false; readonly error: string }

function resolverDirectorio(valor: unknown, base: string): ResultadoDirectorio {
  if (typeof valor !== 'string' || valor.trim() === '') {
    return { ok: true, ruta: base }
  }

  const solicitado = valor.trim()
  let destino: string
  try {
    destino = resolverRutaSegura(solicitado, base)
  } catch {
    return {
      ok: false,
      error: `ERROR: el directorio '${solicitado}' queda fuera del proyecto.\nLa operación no se completó.`,
    }
  }

  let esDirectorio = false
  try {
    esDirectorio = existsSync(destino) && statSync(destino).isDirectory()
  } catch {
    esDirectorio = false
  }

  if (!esDirectorio) {
    return {
      ok: false,
      error: `ERROR: el directorio '${solicitado}' no existe o no es un directorio dentro del proyecto.\nLa operación no se completó.`,
    }
  }

  return { ok: true, ruta: destino }
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
      : 'Ejecuta comandos permitidos del catálogo en el intérprete del sistema. Un comando simple se ejecuta directo; una línea que encadena comandos o que ejecuta código con -c pide aprobación.',
    esquema: {
      type: 'object',
      properties: {
        comando: {
          type: 'string',
          description: esWindows
            ? 'Línea de comando a ejecutar. Solo una invocación, sin ; && || | ni $().'
            : 'Línea de comando a ejecutar. Se admiten ; && || | entre comandos del catálogo, pero la línea compuesta pide aprobación. No se admite $() ni backticks.',
        },
        directorio: {
          type: 'string',
          description:
            'Directorio de trabajo relativo al proyecto. Si se omite, se usa la raíz del proyecto.',
        },
      },
      required: ['comando'],
    },
    accionPermiso: 'shell',
    resolverAccion: (args) =>
      !esWindows && esComandoCompuesto(String(args.comando ?? ''))
        ? 'shell_compuesto'
        : 'shell',
    obtenerRecurso: (args) => String(args.comando ?? '').trim(),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const comando = String(args.comando ?? '').trim()
      const rechazo = validarComando(comando, catalogo, bloqueados, plataforma)
      if (rechazo) return rechazo

      const destino = resolverDirectorio(args.directorio, cwd)
      if (!destino.ok) return destino.error

      const resultado = opciones.ejecutor
        ? await opciones.ejecutor(comando, destino.ruta)
        : esWindows
          ? await ejecutarPowershell(comando, destino.ruta)
          : await ejecutarEnUnix(comando, destino.ruta)

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
