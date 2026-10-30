import { MARCADOR_SKILL_NO_RECORTABLE } from '../context/trimming.js'
import type { EntradaHerramienta } from '../core/registry.js'
import {
  cargarCuerpoSkill,
  type SkillDescubierta,
} from '../skills/descubrir.js'

export interface OpcionesHerramientaSkill {
  alCargarSkill?: ((id: string) => void) | undefined
}

export function crearHerramientaSkill(
  skills: readonly SkillDescubierta[],
  opciones: OpcionesHerramientaSkill = {},
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
      opciones.alCargarSkill?.(skill.id)
      const baseDir = skill.rutaDirectorio
      const textoCuerpo = cargarCuerpoSkill(skill)
      const cuerpo = textoCuerpo.startsWith('\n')
        ? textoCuerpo
        : `\n${textoCuerpo}`
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
