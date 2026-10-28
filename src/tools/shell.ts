import { exec, spawn } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import type { EntradaHerramienta } from '../core/registry.js'
import { evaluarRiesgoRuta, resolverRuta } from './path.js'
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

export interface Redireccion {
  tipo: 'escritura' | 'lectura' | 'fd' | 'heredoc' | 'herestring' | 'proceso'
  operador: string
  destino?: string | undefined
}

export interface AnalisisLinea {
  segmentos: string[]
  redirecciones: Redireccion[]
  compuesta: boolean
  noAnalizable: boolean
  error?: string | undefined
}

const COMILLAS_SIMPLES = /'([^'\\]|\\.)*'/g

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

function consumirParentesis(comando: string, inicio: number): number {
  let profundidad = 0
  let i = inicio

  while (i < comando.length) {
    const caracter = comando[i] as string
    if (caracter === '"' || caracter === "'") {
      const bloque = avanzarComilla(comando, i, caracter)
      i = bloque.siguiente
      continue
    }
    if (caracter === '\\') {
      i += 2
      continue
    }
    if (caracter === '(') profundidad += 1
    if (caracter === ')') {
      profundidad -= 1
      if (profundidad === 0) return i + 1
    }
    i += 1
  }

  return comando.length
}

/**
 * Lee el destino de una redirección. Quita las comillas para que el motivo y la
 * clasificación usen la ruta real.
 */
function leerPalabra(
  comando: string,
  desde: number,
): { palabra: string; siguiente: number } | undefined {
  let i = desde
  while (i < comando.length && /\s/.test(comando[i] as string)) i += 1
  if (i >= comando.length) return undefined

  let palabra = ''
  while (i < comando.length) {
    const caracter = comando[i] as string
    if (/\s/.test(caracter)) break
    if (caracter === '"' || caracter === "'") {
      const bloque = avanzarComilla(comando, i, caracter)
      palabra += bloque.texto.slice(1, -1)
      i = bloque.siguiente
      continue
    }
    if (caracter === '\\') {
      const siguiente = comando[i + 1]
      if (siguiente === undefined) {
        palabra += caracter
        i += 1
        continue
      }
      palabra += siguiente
      i += 2
      continue
    }
    if (
      caracter === ';' ||
      caracter === '|' ||
      caracter === '&' ||
      caracter === '>' ||
      caracter === '<' ||
      caracter === '\n' ||
      caracter === '\r'
    ) {
      break
    }
    palabra += caracter
    i += 1
  }

  return { palabra, siguiente: i }
}

type ResultadoRedireccion =
  | { redireccion: Redireccion; siguiente: number }
  | { error: string }

function intentarRedireccion(
  comando: string,
  i: number,
): ResultadoRedireccion | undefined {
  const resto = comando.slice(i)
  const enLimite = i === 0 || /\s/.test(comando[i - 1] as string)

  const proceso = /^(\d*)(<|>)\(/.exec(resto)
  if (proceso) {
    const operador = `${proceso[1] ?? ''}${proceso[2] ?? ''}`
    return {
      redireccion: { tipo: 'proceso', operador },
      siguiente: consumirParentesis(comando, i + operador.length),
    }
  }

  const fd = /^(\d*)(>&)(\d+|-)/.exec(resto)
  if (fd && (fd[1] === '' || enLimite)) {
    return {
      redireccion: {
        tipo: 'fd',
        operador: `${fd[1] ?? ''}${fd[2] ?? ''}`,
        destino: fd[3],
      },
      siguiente: i + fd[0].length,
    }
  }

  const heredoc = /^(\d*)(<<<|<<-|<<)/.exec(resto)
  if (heredoc && (heredoc[1] === '' || enLimite)) {
    const palabra = leerPalabra(comando, i + heredoc[0].length)
    const operador = `${heredoc[1] ?? ''}${heredoc[2] ?? ''}`
    return {
      redireccion: {
        tipo: heredoc[2] === '<<<' ? 'herestring' : 'heredoc',
        operador,
        destino: palabra?.palabra,
      },
      siguiente: palabra?.siguiente ?? i + heredoc[0].length,
    }
  }

  const escritura = /^(\d*)(&>>|&>|>>|>\||<>|>)/.exec(resto)
  if (escritura && (escritura[1] === '' || enLimite)) {
    const operador = `${escritura[1] ?? ''}${escritura[2] ?? ''}`
    const palabra = leerPalabra(comando, i + escritura[0].length)
    if (!palabra)
      return { error: `La redirección '${operador}' no tiene destino.` }
    return {
      redireccion: { tipo: 'escritura', operador, destino: palabra.palabra },
      siguiente: palabra.siguiente,
    }
  }

  const lectura = /^(\d*)(<)/.exec(resto)
  if (lectura && (lectura[1] === '' || enLimite)) {
    const operador = `${lectura[1] ?? ''}${lectura[2] ?? ''}`
    const palabra = leerPalabra(comando, i + lectura[0].length)
    if (!palabra)
      return { error: `La redirección '${operador}' no tiene destino.` }
    return {
      redireccion: { tipo: 'lectura', operador, destino: palabra.palabra },
      siguiente: palabra.siguiente,
    }
  }

  return undefined
}

/**
 * Analiza la línea completa una sola vez: separa invocaciones, extrae las
 * redirecciones y marca lo que no se puede verificar (heredoc o sustitución de
 * proceso). No decide permisos; eso lo hace el portero con el motivo.
 */
export function analizarLinea(comando: string): AnalisisLinea {
  const segmentos: string[] = []
  const redirecciones: Redireccion[] = []
  let actual = ''
  let compuesta = false
  let noAnalizable = false
  let error: string | undefined
  let i = 0

  const cerrarSegmento = (): void => {
    const limpio = actual.trim()
    if (limpio) segmentos.push(limpio)
    actual = ''
  }

  while (i < comando.length) {
    const caracter = comando[i] as string

    if (caracter === '"' || caracter === "'") {
      const bloque = avanzarComilla(comando, i, caracter)
      actual += bloque.texto
      i = bloque.siguiente
      continue
    }

    if (caracter === '\\') {
      const siguiente = comando[i + 1]
      actual += siguiente === undefined ? caracter : caracter + siguiente
      i += 2
      continue
    }

    const redireccion = intentarRedireccion(comando, i)
    if (redireccion) {
      if ('error' in redireccion) {
        error = redireccion.error
        cerrarSegmento()
        break
      }
      redirecciones.push(redireccion.redireccion)
      i = redireccion.siguiente
      if (
        redireccion.redireccion.tipo === 'heredoc' ||
        redireccion.redireccion.tipo === 'herestring' ||
        redireccion.redireccion.tipo === 'proceso'
      ) {
        noAnalizable = true
        cerrarSegmento()
        break
      }
      continue
    }

    if (
      caracter === ';' ||
      caracter === '|' ||
      caracter === '&' ||
      caracter === '\n' ||
      caracter === '\r'
    ) {
      compuesta = true
      cerrarSegmento()
      i +=
        (caracter === '|' || caracter === '&') && comando[i + 1] === caracter
          ? 2
          : 1
      continue
    }

    actual += caracter
    i += 1
  }

  cerrarSegmento()
  return { segmentos, redirecciones, compuesta, noAnalizable, error }
}

/**
 * Detecta encadenamientos fuera de comillas. En Unix una línea compuesta se
 * evalúa con `shell_compuesto`; en Windows pide aprobación obligatoria.
 */
export function contieneComposicion(comando: string): boolean {
  return analizarLinea(comando).compuesta
}

/**
 * `$()` y backticks ejecutan código que no se puede validar por segmento. Se
 * buscan fuera de comillas simples: dentro de comillas dobles siguen activos.
 */
export function contieneSustitucion(comando: string): boolean {
  const sinSimples = comando.replace(COMILLAS_SIMPLES, '')
  return sinSimples.includes('`') || sinSimples.includes('$(')
}

export function dividirSegmentos(comando: string): string[] {
  return analizarLinea(comando).segmentos
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
  const analisis = analizarLinea(comando)
  if (analisis.compuesta) return true
  return analisis.segmentos.some(esInvocacionConCodigo)
}

function redireccionReal(redireccion: Redireccion): boolean {
  if (redireccion.tipo === 'fd') return false
  if (
    (redireccion.tipo === 'escritura' || redireccion.tipo === 'lectura') &&
    redireccion.destino === '/dev/null'
  ) {
    return false
  }
  return true
}

function motivoDirectorio(
  valor: unknown,
  directorioProyecto: string,
): string | undefined {
  if (typeof valor !== 'string' || valor.trim() === '') return undefined
  const solicitado = valor.trim()
  const riesgo = evaluarRiesgoRuta(solicitado, directorioProyecto)
  if (riesgo.fueraDelProyecto) {
    return `El directorio '${solicitado}' queda fuera del proyecto.`
  }
  if (riesgo.sensible) {
    return `El directorio '${solicitado}' es una ruta protegida.`
  }
  return undefined
}

function motivoShell(
  comando: string,
  plataforma: NodeJS.Platform,
  catalogo: Set<string>,
  bloqueados: Set<string>,
  directorio: unknown,
  directorioProyecto: string,
): string | undefined {
  if (!comando) return undefined

  if (contieneSustitucion(comando)) {
    return 'La línea usa sustitución de comandos ($() o backticks).'
  }

  const analisis = analizarLinea(comando)

  if (analisis.noAnalizable) {
    return 'La línea usa una redirección que no se puede verificar (heredoc, herestring o sustitución de proceso).'
  }

  for (const segmento of analisis.segmentos) {
    const nombre = extraerNombreBinario(segmento)
    if (bloqueados.has(nombre)) {
      return `El comando '${nombre}' pertenece a la lista negra de la plataforma.`
    }
  }

  for (const segmento of analisis.segmentos) {
    const nombre = extraerNombreBinario(segmento)
    if (!catalogo.has(nombre)) {
      return `El comando '${nombre}' no pertenece al catálogo de la plataforma '${plataforma}'.`
    }
  }

  const redireccion = analisis.redirecciones.find(redireccionReal)
  if (redireccion) {
    const direccion =
      redireccion.tipo === 'escritura' ? 'la salida a' : 'la entrada desde'
    return `La línea redirige ${direccion} '${redireccion.destino ?? ''}'.`
  }

  if (analisis.segmentos.some(esInvocacionConCodigo)) {
    return 'La línea ejecuta código a través de un intérprete.'
  }

  if (plataforma === 'win32' && analisis.compuesta) {
    return 'La línea compone varios comandos en Windows.'
  }

  const motivoDelDirectorio = motivoDirectorio(directorio, directorioProyecto)
  if (motivoDelDirectorio) return motivoDelDirectorio

  return analisis.error
}

type ResultadoDirectorio =
  | { readonly ok: true; readonly ruta: string }
  | { readonly ok: false; readonly error: string }

function resolverDirectorio(valor: unknown, base: string): ResultadoDirectorio {
  if (typeof valor !== 'string' || valor.trim() === '') {
    return { ok: true, ruta: base }
  }

  const solicitado = valor.trim()
  const destino = resolverRuta(solicitado, base)

  let esDirectorio = false
  try {
    esDirectorio = existsSync(destino) && statSync(destino).isDirectory()
  } catch {
    esDirectorio = false
  }

  if (!esDirectorio) {
    return {
      ok: false,
      error: `ERROR: el directorio '${solicitado}' no existe o no es un directorio.\nLa operación no se completó.`,
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
      ? 'Ejecuta una línea con PowerShell. Los comandos fuera del catálogo, la composición, las redirecciones y el código de un intérprete piden aprobación obligatoria.'
      : 'Ejecuta una línea en el intérprete del sistema. Los comandos de la lista negra, los que no están en el catálogo, las redirecciones y el código de un intérprete piden aprobación obligatoria.',
    esquema: {
      type: 'object',
      properties: {
        comando: {
          type: 'string',
          description:
            'Línea de comando a ejecutar. Se admiten composición y redirecciones; lo riesgoso pide aprobación obligatoria.',
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
    resolverAccion: (args) => {
      const comando = String(args.comando ?? '')
      const analisis = analizarLinea(comando)
      if (
        analisis.compuesta ||
        analisis.segmentos.some(esInvocacionConCodigo)
      ) {
        return 'shell_compuesto'
      }
      if (analisis.redirecciones.some(redireccionReal)) {
        return 'shell_redireccion'
      }
      return 'shell'
    },
    obtenerRecurso: (args) => String(args.comando ?? '').trim(),
    motivoAprobacionObligatoria: (args) =>
      motivoShell(
        String(args.comando ?? '').trim(),
        plataforma,
        catalogo,
        bloqueados,
        args.directorio,
        cwd,
      ),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const comando = String(args.comando ?? '').trim()
      if (!comando) return 'ERROR: el comando está vacío.'

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
