import { readFileSync, readdirSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

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

function esSlugValido(id: string): boolean {
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

function listarSoportes(directorio: string): string[] {
  const soportes: string[] = []
  try {
    const entradas = readdirSync(directorio, { withFileTypes: true })
    for (const entrada of entradas) {
      if (entrada.isDirectory()) continue
      const nombre = entrada.name
      if (nombre === 'SKILL.md') continue
      const ruta = join(directorio, nombre)
      try {
        const stat = statSync(ruta)
        if (stat.isFile()) {
          soportes.push(ruta)
        }
      } catch {
        // ignorar
      }
      if (soportes.length >= 10) break
    }
  } catch {
    // ignorar
  }
  return soportes.slice(0, 10)
}

function leerSkillArchivo(
  rutaArchivo: string,
  id: string,
  topeBytes: number,
  avisos: string[],
): SkillDescubierta | null {
  let stat
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
    avisos.push(`Skill omitida (${id}): frontmatter inválido en ${rutaArchivo}`)
    return null
  }
  const descripcion = fm.datos['description']?.trim()
  if (!descripcion) {
    avisos.push(`Skill omitida (${id}): falta description en ${rutaArchivo}`)
    return null
  }
  const nombre = fm.datos['name']?.trim() || id
  const cuerpo = extraerCuerpo(contenido, fm.cuerpoInicio)
  const rutaDirectorio = dirname(rutaArchivo)
  const soportes = rutaDirectorio === dirname(rutaArchivo) ? listarSoportes(rutaDirectorio) : []
  return {
    id,
    nombre,
    descripcion,
    rutaArchivo,
    rutaDirectorio,
    cuerpo,
    tamanioBytes,
    soportes,
  }
}

export function descubrirSkills(
  directorioProyecto: string,
  opciones: { topeBytes?: number } = {},
): { skills: SkillDescubierta[]; avisos: string[] } {
  const topeBytes = opciones.topeBytes ?? DEFAULT_TOPE_SKILL_BYTES
  const raizSkills = join(directorioProyecto, '.opencode', 'skills')
  const avisos: string[] = []
  const skills: SkillDescubierta[] = []
  const vistos = new Set<string>()

  try {
    const statRaiz = statSync(raizSkills)
    if (!statRaiz.isDirectory()) {
      return { skills: [], avisos: [] }
    }
  } catch {
    return { skills: [], avisos: [] }
  }

  try {
    const entradas = readdirSync(raizSkills, { withFileTypes: true })
    // forma directorio
    for (const entrada of entradas) {
      if (!entrada.isDirectory()) continue
      const id = entrada.name
      if (!esSlugValido(id)) {
        avisos.push(`Skill omitida (${id}): identificador no válido`)
        continue
      }
      const rutaArchivo = join(raizSkills, id, 'SKILL.md')
      const skill = leerSkillArchivo(rutaArchivo, id, topeBytes, avisos)
      if (skill) {
        skills.push(skill)
        vistos.add(id)
      }
    }
    // forma plana
    for (const entrada of entradas) {
      if (entrada.isDirectory()) continue
      const nombreArchivo = entrada.name
      if (!nombreArchivo.endsWith('.md')) continue
      if (nombreArchivo === 'SKILL.md') continue
      const base = nombreArchivo.replace(/\.md$/i, '')
      if (vistos.has(base)) continue
      if (!esSlugValido(base)) {
        avisos.push(`Skill omitida (${base}): identificador no válido`)
        continue
      }
      const rutaArchivo = join(raizSkills, nombreArchivo)
      const skill = leerSkillArchivo(rutaArchivo, base, topeBytes, avisos)
      if (skill) {
        skills.push(skill)
        vistos.add(base)
      }
    }
  } catch {
    return { skills: [], avisos: [] }
  }

  return { skills, avisos }
}

export function obtenerSkillsVisibles(
  skills: SkillDescubierta[],
  reglas: Array<{ accion: string; recurso: string; efecto: string }>,
  evaluador?: (accion: string, recurso: string) => { efecto: string },
): SkillDescubierta[] {
  if (!evaluador) return skills
  const visibles: SkillDescubierta[] = []
  for (const skill of skills) {
    const res = evaluador('skill', skill.id)
    if (res.efecto === 'denegar') continue
    visibles.push(skill)
  }
  return visibles
}
