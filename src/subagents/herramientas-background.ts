import type { EntradaHerramienta } from '../core/registry.js'
import { describirTarea, type GestorTareasBackground } from './background.js'

export function crearHerramientaEstadoTareas(
  gestor: GestorTareasBackground,
): EntradaHerramienta {
  return {
    nombre: 'task_status',
    descripcion:
      'Consulta el estado de una tarea en background por su identificador, o lista todas las tareas.',
    esquema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Identificador de la tarea; si se omite, lista todas.',
        },
      },
    },
    accionPermiso: 'read',
    obtenerRecurso: (args) => String(args.id ?? 'background'),
    admiteParalelo: true,
    ejecutar: async (args) => {
      const id = typeof args.id === 'string' ? args.id.trim() : ''
      if (id) {
        const tarea = gestor.obtener(id)
        if (!tarea) {
          return `ERROR: No existe una tarea en background con el identificador '${id}'.\nLa operación no se completó.`
        }
        return describirTarea(tarea)
      }

      const tareas = gestor.listar()
      if (tareas.length === 0) {
        return 'No hay tareas en background en esta sesión.'
      }
      return tareas.map((tarea) => describirTarea(tarea)).join('\n\n')
    },
  }
}

export function crearHerramientaCancelarTarea(
  gestor: GestorTareasBackground,
): EntradaHerramienta {
  return {
    nombre: 'task_cancel',
    descripcion: 'Cancela una tarea en background que todavía está en curso.',
    esquema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Identificador de la tarea a cancelar.',
        },
      },
      required: ['id'],
    },
    accionPermiso: 'subagent',
    obtenerRecurso: (args) => String(args.id ?? ''),
    admiteParalelo: false,
    ejecutar: async (args) => {
      const id = typeof args.id === 'string' ? args.id.trim() : ''
      if (!id) {
        return "ERROR: El argumento 'id' es obligatorio y debe ser texto no vacío.\nLa operación no se completó."
      }
      const tarea = gestor.obtener(id)
      if (!tarea) {
        return `ERROR: No existe una tarea en background con el identificador '${id}'.\nLa operación no se completó.`
      }
      if (tarea.estado !== 'en_curso') {
        return `La tarea ${id} ya terminó con estado '${tarea.estado}'.`
      }
      gestor.cancelar(id)
      return `Tarea ${id} cancelada.`
    },
  }
}
