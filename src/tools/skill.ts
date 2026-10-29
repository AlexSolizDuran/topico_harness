import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { EntradaHerramienta } from '../core/registry.js'
import { MARCADOR_SKILL_NO_RECORTABLE } from '../context/trimming.js'
import type { SkillDescubierta } from '../skills/descubrir.js'

export function crearHerramientaSkill(
  skills: SkillDescubierta[],
): EntradaHerramienta {
  const mapa = new Map<string, SkillDescubierta>()
  for (const skill of skills) {
    mapa.set(skill.id, skill)
  }

  return {
    nombre: 'skill',
    descripcion:
      'Carga el cuerpo completo de una skill del catálogo para seguir sus instrucciones paso a paso.',
    esquema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Identificador de la skill',
        },
      },
      required: ['id'],
    },
    accionPermiso: 'skill',
    obtenerRecurso: (args) => String(args.id ?? ''),
    ejecutar: async (args) => {
      const id = String(args.id ?? '')
      const skill = mapa.get(id)
      if (!skill) {
        return `ERROR: Skill no encontrada: ${id}`
      }
      const baseDir = skill.rutaDirectorio
      const cuerpo = skill.cuerpo.startsWith('\n')
        ? skill.cuerpo
        : `\n${skill.cuerpo}`
      const encabezado = [
        `Skill: ${skill.nombre} (${skill.id})`,
        `Directorio base: ${baseDir}`,
        'Archivos de apoyo:',
      ]
      const lineasSoportes =
        skill.soportes.length > 0
          ? skill.soportes.map((s) => `- ${s}`)
          : ['- (ninguno)']
      const resultado = [
        ...encabezado,
        ...lineasSoportes,
        '',
        '---',
        cuerpo,
        '',
        MARCADOR_SKILL_NO_RECORTABLE,
      ].join('\n')
      return resultado
    },
  }
}
