import { readdirSync, readFileSync, type Stats, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const DEFAULT_TOPE_SKILL_BYTES = 32 * 1024

export class ErrorSkillExcedida extends Error {
  constructor(
    public readonly ruta: string,
    public readonly tamanio: number,
    public readonly tope: number,
  ) {
    super(
      `SKILL.md excede el tope permitido: ${ruta} pesa ${tamanio} bytes, el tope es ${tope} bytes.`,
    )
    this.name = 'ErrorSkillExcedida'
  }
}

export interface SkillSoporte {
  ruta: string
}

export interface SkillOmitida {
  id: string
  motivo: string
  ruta?: string | undefined
}

export interface SkillDescubierta {
  id: string
  nombre: string
  descripcion: string
  rutaArchivo: string
  rutaDirectorio: string
  cuerpo: string
  tamanioBytes: number
  soportes: string[]
}

interface ParseoFrontmatter {
  datos: Record<string, string>
  cuerpoInicio: number
}

export function esSlugValido(id: string): boolean {
  if (!id) return false
  if (id.length > 64) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)
}

function parsearFrontmatter(contenido: string): ParseoFrontmatter | null {
  const match = contenido.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!match) return null
  const bloque = match[1] ?? ''
  const datos: Record<string, string> = {}
  for (const linea of bloque.split(/\r?\n/)) {
    const idx = linea.indexOf(':')
    if (idx <= 0) continue
    const clave = linea.slice(0, idx).trim().toLowerCase()
    let valor = linea.slice(idx + 1).trim()
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1)
    }
    datos[clave] = valor
  }
  return { datos, cuerpoInicio: match[0].length }
}

function extraerCuerpo(contenido: string, inicio: number): string {
  return contenido.slice(inicio)
}

function listarSoportesRecursivo(
  directorio: string,
  acumulado: string[],
): void {
  if (acumulado.length >= 10) return
  try {
    const entradas = readdirSync(directorio, { withFileTypes: true })
    for (const entrada of entradas) {
      if (acumulado.length >= 10) break
      const ruta = join(directorio, entrada.name)
      if (entrada.isDirectory()) {
        listarSoportesRecursivo(ruta, acumulado)
        continue
      }
      if (entrada.name === 'SKILL.md') continue
      try {
        const stat = statSync(ruta)
        if (stat.isFile()) {
          acumulado.push(ruta)
        }
      } catch {
        // ignorar archivo inaccesible
      }
    }
  } catch {
    // ignorar directorio inaccesible
  }
}

function listarSoportes(directorio: string): string[] {
  const soportes: string[] = []
  listarSoportesRecursivo(directorio, soportes)
  return soportes.slice(0, 10)
}

export function cargarCuerpoSkill(skill: SkillDescubierta): string {
  if (skill.cuerpo) {
    return skill.cuerpo
  }
  const contenido = readFileSync(skill.rutaArchivo, 'utf-8')
  const fm = parsearFrontmatter(contenido)
  return fm ? extraerCuerpo(contenido, fm.cuerpoInicio) : contenido
}

function leerSkillArchivo(
  rutaArchivo: string,
  id: string,
  topeBytes: number,
  esDirectorio: boolean,
  avisos: string[],
  omitidas: SkillOmitida[],
): SkillDescubierta | null {
  let stat: Stats
  try {
    stat = statSync(rutaArchivo)
  } catch {
    return null
  }
  if (!stat.isFile()) return null
  const tamanioBytes = stat.size
  if (tamanioBytes > topeBytes) {
    throw new ErrorSkillExcedida(rutaArchivo, tamanioBytes, topeBytes)
  }
  let contenido: string
  try {
    contenido = readFileSync(rutaArchivo, 'utf-8')
  } catch {
    return null
  }
  const fm = parsearFrontmatter(contenido)
  if (!fm) {
    const motivo = `frontmatter inválido en ${rutaArchivo}`
    avisos.push(`Skill omitida (${id}): ${motivo}`)
    omitidas.push({ id, motivo, ruta: rutaArchivo })
    return null
  }
  const descripcion = fm.datos.description?.trim()
  if (!descripcion) {
    const motivo = `falta description en ${rutaArchivo}`
    avisos.push(`Skill omitida (${id}): ${motivo}`)
    omitidas.push({ id, motivo, ruta: rutaArchivo })
    return null
  }
  const nombre = fm.datos.name?.trim() || id
  const cuerpoInicio = fm.cuerpoInicio
  const rutaDirectorio = dirname(rutaArchivo)
  const soportes = esDirectorio ? listarSoportes(rutaDirectorio) : []

  const skill: SkillDescubierta = {
    id,
    nombre,
    descripcion,
    rutaArchivo,
    rutaDirectorio,
    cuerpo: '',
    tamanioBytes,
    soportes,
  }

  Object.defineProperty(skill, 'cuerpo', {
    enumerable: true,
    configurable: true,
    get(): string {
      const texto = readFileSync(rutaArchivo, 'utf-8')
      return extraerCuerpo(texto, cuerpoInicio)
    },
  })

  return skill
}

export function descubrirSkills(
  directorioProyecto: string,
  opciones: { topeBytes?: number | undefined } = {},
): {
  skills: SkillDescubierta[]
  avisos: string[]
  omitidas: SkillOmitida[]
} {
  const topeBytes = opciones.topeBytes ?? DEFAULT_TOPE_SKILL_BYTES
  const raizSkills = join(directorioProyecto, '.opencode', 'skills')
  const avisos: string[] = []
  const omitidas: SkillOmitida[] = []
  const skills: SkillDescubierta[] = []
  const vistos = new Set<string>()

  try {
    const statRaiz = statSync(raizSkills)
    if (!statRaiz.isDirectory()) {
      return { skills: [], avisos: [], omitidas: [] }
    }
  } catch {
    return { skills: [], avisos: [], omitidas: [] }
  }

  try {
    const entradas = readdirSync(raizSkills, { withFileTypes: true })
    // Forma directorio: .opencode/skills/<id>/SKILL.md
    for (const entrada of entradas) {
      if (!entrada.isDirectory()) continue
      const id = entrada.name
      if (!esSlugValido(id)) {
        const motivo = 'identificador no es un slug válido'
        avisos.push(`Skill omitida (${id}): ${motivo}`)
        omitidas.push({ id, motivo, ruta: join(raizSkills, id) })
        continue
      }
      const rutaArchivo = join(raizSkills, id, 'SKILL.md')
      const skill = leerSkillArchivo(
        rutaArchivo,
        id,
        topeBytes,
        true,
        avisos,
        omitidas,
      )
      if (skill) {
        skills.push(skill)
        vistos.add(id)
      }
    }
    // Forma plana: .opencode/skills/<id>.md
    for (const entrada of entradas) {
      if (entrada.isDirectory()) continue
      const nombreArchivo = entrada.name
      if (!nombreArchivo.endsWith('.md')) continue
      if (nombreArchivo === 'SKILL.md') continue
      const base = nombreArchivo.replace(/\.md$/i, '')
      if (vistos.has(base)) continue
      if (!esSlugValido(base)) {
        const motivo = 'identificador no es un slug válido'
        avisos.push(`Skill omitida (${base}): ${motivo}`)
        omitidas.push({
          id: base,
          motivo,
          ruta: join(raizSkills, nombreArchivo),
        })
        continue
      }
      const rutaArchivo = join(raizSkills, nombreArchivo)
      const skill = leerSkillArchivo(
        rutaArchivo,
        base,
        topeBytes,
        false,
        avisos,
        omitidas,
      )
      if (skill) {
        skills.push(skill)
        vistos.add(base)
      }
    }
  } catch (err) {
    if (err instanceof ErrorSkillExcedida) {
      throw err
    }
    return { skills: [], avisos: [], omitidas: [] }
  }

  return { skills, avisos, omitidas }
}

export function obtenerSkillsVisibles(
  skills: readonly SkillDescubierta[],
  _reglas: ReadonlyArray<{ accion: string; recurso: string; efecto: string }>,
  evaluador?: (accion: string, recurso: string) => { efecto: string },
): SkillDescubierta[] {
  if (!evaluador) return [...skills]
  const visibles: SkillDescubierta[] = []
  for (const skill of skills) {
    const res = evaluador('skill', skill.id)
    if (res.efecto === 'denegar') continue
    visibles.push(skill)
  }
  return visibles
}

export function formatearCatalogoSkills(
  skills: readonly SkillDescubierta[],
): string {
  if (skills.length === 0) return ''
  const lineas = skills.map((s) => `- ${s.id} (${s.nombre}): ${s.descripcion}`)
  return `[SKILLS DISPONIBLES]\n${lineas.join('\n')}`
}
