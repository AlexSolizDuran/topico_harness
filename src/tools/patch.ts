import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { EntradaHerramienta } from '../core/registry.js'
import { detectarEol, normalizarEol, restaurarEol } from './eol.js'
import { resolverRutaSegura } from './path.js'
import { MAXIMO_CONTENIDO_POR_DEFECTO, truncarContenido } from './truncate.js'

export class ErrorParche extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorParche'
  }
}

type Intencion = 'agregar' | 'actualizar' | 'borrar'

interface Hunk {
  viejas: string[]
  nuevas: string[]
  origen: number
  cambios: number
}

interface Bloque {
  intencion: Intencion
  ruta: string
  origen: number
  contenido: string[]
  hunks: Hunk[]
}

interface ArchivoPlanificado {
  ruta: string
  rutaAbsoluta: string
  intencion: Intencion
  contenidoFinal?: string | undefined
  original?: string | undefined
}

const DIRECTIVA = /^\*\*\* (Add|Update|Delete) File: (.+)$/
const ETIQUETA_HUNK = /^@@/

function describirIntencion(intencion: Intencion): string {
  if (intencion === 'agregar') return 'agregar'
  if (intencion === 'borrar') return 'borrar'
  return 'actualizar'
}

function verificarCierre(lineas: string[], indice: number): void {
  for (let i = indice; i < lineas.length; i++) {
    if ((lineas[i] ?? '').trim() !== '') {
      throw new ErrorParche(
        `El parche tiene contenido después de '*** End Patch' en la línea ${i + 1}.`,
      )
    }
  }
}

function leerAgregado(
  lineas: string[],
  desde: number,
  hasta: number,
  bloque: Bloque,
): void {
  for (let i = desde; i < hasta; i++) {
    const linea = lineas[i] ?? ''
    if (!linea.startsWith('+')) {
      throw new ErrorParche(
        `La línea ${i + 1} del bloque que agrega '${bloque.ruta}' debe empezar con '+'.`,
      )
    }
    bloque.contenido.push(linea.slice(1))
  }
}

function cerrarHunk(bloque: Bloque, hunk: Hunk | undefined): void {
  if (!hunk) return
  if (hunk.viejas.length === 0) {
    throw new ErrorParche(
      `El bloque que actualiza '${bloque.ruta}' tiene un hunk sin líneas de contexto ni de eliminación (línea ${hunk.origen}).`,
    )
  }
  if (hunk.cambios === 0) {
    throw new ErrorParche(
      `El bloque que actualiza '${bloque.ruta}' no agrega ni quita líneas (línea ${hunk.origen}).`,
    )
  }
  bloque.hunks.push(hunk)
}

function agregarLineaHunk(
  hunk: Hunk,
  linea: string,
  indice: number,
  ruta: string,
): void {
  // Una línea vacía se interpreta como contexto vacío: es lo que produce un
  // archivo con una línea en blanco y evita exigir un espacio invisible.
  const prefijo = linea === '' ? ' ' : linea[0]
  const texto = linea === '' ? '' : linea.slice(1)

  if (prefijo === ' ') {
    hunk.viejas.push(texto)
    hunk.nuevas.push(texto)
    return
  }
  if (prefijo === '-') {
    hunk.viejas.push(texto)
    hunk.cambios++
    return
  }
  if (prefijo === '+') {
    hunk.nuevas.push(texto)
    hunk.cambios++
    return
  }
  throw new ErrorParche(
    `La línea ${indice + 1} del bloque que actualiza '${ruta}' usa un prefijo desconocido; se esperaba ' ', '-' o '+'.`,
  )
}

function leerActualizacion(
  lineas: string[],
  desde: number,
  hasta: number,
  bloque: Bloque,
): void {
  let hunk: Hunk | undefined
  for (let i = desde; i < hasta; i++) {
    const linea = lineas[i] ?? ''
    if (ETIQUETA_HUNK.test(linea)) {
      cerrarHunk(bloque, hunk)
      hunk = { viejas: [], nuevas: [], origen: i + 1, cambios: 0 }
      continue
    }
    if (!hunk) {
      throw new ErrorParche(
        `La línea ${i + 1} del bloque que actualiza '${bloque.ruta}' aparece antes del primer '@@'.`,
      )
    }
    agregarLineaHunk(hunk, linea, i, bloque.ruta)
  }
  cerrarHunk(bloque, hunk)
}

function leerBorrado(
  lineas: string[],
  desde: number,
  hasta: number,
  bloque: Bloque,
): void {
  for (let i = desde; i < hasta; i++) {
    if ((lineas[i] ?? '').trim() !== '') {
      throw new ErrorParche(
        `El bloque que borra '${bloque.ruta}' no admite contenido (línea ${i + 1}).`,
      )
    }
  }
}

function buscarInicio(lineas: string[]): number {
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i] ?? ''
    if (linea.trim() === '*** Begin Patch') return i
    if (linea.trim() !== '') {
      throw new ErrorParche(
        `El parche debe empezar con '*** Begin Patch' (línea ${i + 1}).`,
      )
    }
  }
  return -1
}

function crearBloque(linea: string, indice: number): Bloque | undefined {
  const coincidencia = DIRECTIVA.exec(linea)
  if (!coincidencia) return undefined
  const ruta = (coincidencia[2] ?? '').trim()
  if (!ruta) {
    throw new ErrorParche(
      `La línea ${indice + 1} declara un bloque sin ruta de archivo.`,
    )
  }
  const intencion: Intencion =
    coincidencia[1] === 'Add'
      ? 'agregar'
      : coincidencia[1] === 'Delete'
        ? 'borrar'
        : 'actualizar'
  return { intencion, ruta, origen: indice, contenido: [], hunks: [] }
}

/**
 * Convierte el texto de un parche en bloques validados. No toca el disco.
 * Los errores nombran la línea del parche, nunca el contenido.
 */
export function parsearParche(texto: string): Bloque[] {
  const lineas = normalizarEol(texto).split('\n')
  const bloques: Bloque[] = []
  const inicio = buscarInicio(lineas)

  if (inicio === -1) {
    throw new ErrorParche("El parche no contiene '*** Begin Patch'.")
  }

  let bloque: Bloque | undefined

  for (let indice = inicio + 1; indice < lineas.length; indice++) {
    const linea = lineas[indice] ?? ''
    const recortada = linea.trim()

    if (recortada === '*** End Patch') {
      incorporarBloque(bloques, bloque, lineas, indice)
      verificarCierre(lineas, indice + 1)
      if (bloques.length === 0) {
        throw new ErrorParche('El parche no contiene ningún bloque de archivo.')
      }
      return bloques
    }

    const nuevo = crearBloque(linea, indice)
    if (nuevo) {
      incorporarBloque(bloques, bloque, lineas, indice)
      bloque = nuevo
      continue
    }

    validarLineaSuelta(linea, indice, Boolean(bloque))
  }

  throw new ErrorParche("El parche no contiene '*** End Patch'.")
}

function asignarCuerpo(
  bloque: Bloque,
  lineas: string[],
  desde: number,
  hasta: number,
): void {
  if (bloque.intencion === 'agregar') {
    leerAgregado(lineas, desde, hasta, bloque)
    return
  }
  if (bloque.intencion === 'actualizar') {
    leerActualizacion(lineas, desde, hasta, bloque)
    return
  }
  leerBorrado(lineas, desde, hasta, bloque)
}

function incorporarBloque(
  bloques: Bloque[],
  bloque: Bloque | undefined,
  lineas: string[],
  indice: number,
): void {
  if (!bloque) return
  asignarCuerpo(bloque, lineas, bloque.origen + 1, indice)
  bloques.push(bloque)
}

function validarLineaSuelta(
  linea: string,
  indice: number,
  hayBloque: boolean,
): void {
  const recortada = linea.trim()
  if (recortada.startsWith('***')) {
    throw new ErrorParche(
      `Directiva desconocida en la línea ${indice + 1}: '${recortada}'.`,
    )
  }
  if (!hayBloque && recortada !== '') {
    throw new ErrorParche(
      `La línea ${indice + 1} aparece fuera de un bloque de archivo.`,
    )
  }
}

export function rutasDelParche(texto: string): string[] {
  const rutas: string[] = []
  for (const linea of normalizarEol(texto).split('\n')) {
    const coincidencia = DIRECTIVA.exec(linea)
    const ruta = coincidencia?.[2]?.trim()
    if (ruta && !rutas.includes(ruta)) {
      rutas.push(ruta)
    }
  }
  return rutas
}

function esArchivo(rutaAbsoluta: string): boolean {
  try {
    return statSync(rutaAbsoluta).isFile()
  } catch {
    return false
  }
}

function existe(rutaAbsoluta: string): boolean {
  return existsSync(rutaAbsoluta)
}

function contarCoincidencias(lineas: string[], buscadas: string[]): number {
  if (buscadas.length === 0) return 0
  let total = 0
  for (let i = 0; i + buscadas.length <= lineas.length; i++) {
    let coincide = true
    for (let j = 0; j < buscadas.length; j++) {
      if (lineas[i + j] !== buscadas[j]) {
        coincide = false
        break
      }
    }
    if (coincide) total++
  }
  return total
}

function aplicarHunks(
  contenido: string,
  bloque: Bloque,
): { contenido: string; eol: '\r\n' | '\n' } {
  const eol = detectarEol(contenido)
  const lineas = normalizarEol(contenido).split('\n')

  for (const hunk of bloque.hunks) {
    const coincidencias = contarCoincidencias(lineas, hunk.viejas)
    if (coincidencias === 0) {
      throw new ErrorParche(
        `El bloque que actualiza '${bloque.ruta}' no encontró sus líneas de contexto cerca de la línea ${hunk.origen}.`,
      )
    }
    if (coincidencias > 1) {
      throw new ErrorParche(
        `El bloque que actualiza '${bloque.ruta}' encontró ${coincidencias} coincidencias cerca de la línea ${hunk.origen}; se esperaba una sola.`,
      )
    }
    const posicion = lineas.findIndex((_, i) => {
      if (i + hunk.viejas.length > lineas.length) return false
      return hunk.viejas.every((linea, j) => lineas[i + j] === linea)
    })
    lineas.splice(posicion, hunk.viejas.length, ...hunk.nuevas)
  }

  return { contenido: restaurarEol(lineas.join('\n'), eol), eol }
}

function construirPlan(
  bloques: Bloque[],
  directorioProyecto: string,
): ArchivoPlanificado[] {
  const vistos = new Set<string>()
  const plan: ArchivoPlanificado[] = []

  for (const bloque of bloques) {
    const rutaAbsoluta = resolverRutaSegura(bloque.ruta, directorioProyecto)
    if (vistos.has(rutaAbsoluta)) {
      throw new ErrorParche(
        `La ruta '${bloque.ruta}' aparece más de una vez en el parche.`,
      )
    }
    vistos.add(rutaAbsoluta)

    if (bloque.intencion === 'agregar') {
      if (existe(rutaAbsoluta)) {
        throw new ErrorParche(
          `No se puede agregar '${bloque.ruta}': la ruta ya existe.`,
        )
      }
      const contenido = bloque.contenido.join('\n')
      plan.push({
        ruta: bloque.ruta,
        rutaAbsoluta,
        intencion: bloque.intencion,
        contenidoFinal:
          bloque.contenido.length > 0 ? `${contenido}\n` : contenido,
      })
      continue
    }

    if (!esArchivo(rutaAbsoluta)) {
      throw new ErrorParche(
        `No se puede ${describirIntencion(bloque.intencion)} '${bloque.ruta}': el archivo no existe o no es un archivo.`,
      )
    }

    if (bloque.intencion === 'borrar') {
      plan.push({
        ruta: bloque.ruta,
        rutaAbsoluta,
        intencion: bloque.intencion,
      })
      continue
    }

    plan.push({
      ruta: bloque.ruta,
      rutaAbsoluta,
      intencion: bloque.intencion,
      original: '',
    })
  }

  return plan
}

async function cargarOriginales(plan: ArchivoPlanificado[]): Promise<void> {
  for (const archivo of plan) {
    if (archivo.intencion === 'agregar') continue
    archivo.original = await readFile(archivo.rutaAbsoluta, 'utf-8')
  }
}

function calcularActualizaciones(
  plan: ArchivoPlanificado[],
  bloques: Bloque[],
): void {
  for (let i = 0; i < plan.length; i++) {
    const archivo = plan[i]
    const bloque = bloques[i]
    if (!archivo || !bloque || archivo.intencion !== 'actualizar') continue
    const resultado = aplicarHunks(archivo.original ?? '', bloque)
    archivo.contenidoFinal = resultado.contenido
  }
}

async function revertir(escritos: ArchivoPlanificado[]): Promise<string[]> {
  const fallos: string[] = []
  for (const archivo of [...escritos].reverse()) {
    try {
      if (archivo.intencion === 'agregar') {
        await unlink(archivo.rutaAbsoluta)
      } else if (archivo.original !== undefined) {
        await writeFile(archivo.rutaAbsoluta, archivo.original, 'utf-8')
      }
    } catch {
      fallos.push(archivo.ruta)
    }
  }
  return fallos
}

async function escribirPlan(plan: ArchivoPlanificado[]): Promise<void> {
  const escritos: ArchivoPlanificado[] = []
  for (const archivo of plan) {
    try {
      if (archivo.intencion === 'agregar') {
        await mkdir(dirname(archivo.rutaAbsoluta), { recursive: true })
        await writeFile(
          archivo.rutaAbsoluta,
          archivo.contenidoFinal ?? '',
          'utf-8',
        )
      } else if (archivo.intencion === 'actualizar') {
        await writeFile(
          archivo.rutaAbsoluta,
          archivo.contenidoFinal ?? '',
          'utf-8',
        )
      } else {
        await unlink(archivo.rutaAbsoluta)
      }
      escritos.push(archivo)
    } catch (error) {
      const fallos = await revertir(escritos)
      const detalle =
        fallos.length > 0
          ? ` No se pudieron restaurar: ${fallos.join(', ')}.`
          : ''
      throw new ErrorParche(
        `No se pudo escribir '${archivo.ruta}': ${(error as Error).message}.${detalle}`,
      )
    }
  }
}

function resumir(plan: ArchivoPlanificado[]): string {
  const agregados = plan.filter((a) => a.intencion === 'agregar').length
  const actualizados = plan.filter((a) => a.intencion === 'actualizar').length
  const borrados = plan.filter((a) => a.intencion === 'borrar').length
  const partes = [
    agregados > 0 ? `${agregados} agregado(s)` : '',
    actualizados > 0 ? `${actualizados} actualizado(s)` : '',
    borrados > 0 ? `${borrados} borrado(s)` : '',
  ].filter(Boolean)

  const detalle = plan.map((archivo) => {
    if (archivo.intencion === 'agregar') return `+ ${archivo.ruta}`
    if (archivo.intencion === 'actualizar') return `~ ${archivo.ruta}`
    return `- ${archivo.ruta}`
  })

  return [`Parche aplicado: ${partes.join(', ')}.`, ...detalle].join('\n')
}

export function crearHerramientaParche(
  directorioProyecto: string = process.cwd(),
  maximoContenido?: number,
): EntradaHerramienta {
  return {
    nombre: 'apply_patch',
    descripcion:
      'Aplica un parche de varios archivos con bloques que agregan, actualizan o borran, validando todo antes de escribir.',
    esquema: {
      type: 'object',
      properties: {
        patch: {
          type: 'string',
          description:
            "Parche delimitado por '*** Begin Patch' y '*** End Patch' con bloques '*** Add File:', '*** Update File:' y '*** Delete File:'.",
        },
      },
      required: ['patch'],
    },
    accionPermiso: 'edit',
    obtenerRecurso: (args) => {
      const rutas = rutasDelParche(String(args.patch ?? ''))
      return rutas.length > 0 ? rutas : '*'
    },
    admiteParalelo: false,
    ejecutar: async (args) => {
      const texto = String(args.patch ?? '')
      const bloques = parsearParche(texto)
      const plan = construirPlan(bloques, directorioProyecto)

      await cargarOriginales(plan)
      calcularActualizaciones(plan, bloques)
      await escribirPlan(plan)

      return truncarContenido(
        resumir(plan),
        maximoContenido ?? MAXIMO_CONTENIDO_POR_DEFECTO,
      )
    },
  }
}
