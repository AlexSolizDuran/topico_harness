import { z } from 'zod'
import { evaluarOperacionPermiso } from '../permissions/reglas.js'
import type { ReglaPermiso } from '../types.js'
import type { GestorLsp } from './gestor.js'
import type { ArgumentosHerramientaLsp } from './types.js'

export const esquemaHerramientaLsp = z.object({
  operacion: z.enum([
    'definition',
    'references',
    'documentSymbols',
    'workspaceSymbols',
    'hover',
    'diagnostics',
  ]),
  ruta: z.string().optional(),
  linea: z.number().optional(),
  caracter: z.number().optional(),
  simbolo: z.string().optional(),
})

export interface OpcionesHerramientaLsp {
  gestorLsp: GestorLsp
  reglasGlobales?: readonly ReglaPermiso[] | undefined
  reglasAgente?: readonly ReglaPermiso[] | undefined
  aprobacionesGuardadas?: readonly ReglaPermiso[] | undefined
  directorioProyecto?: string | undefined
}

export function crearHerramientaLsp(opciones: OpcionesHerramientaLsp) {
  return {
    nombre: 'lsp',
    descripcion:
      'Consulta información semántica de código mediante Language Server Protocol (definición, referencias, símbolos, hover, diagnósticos). Es de solo lectura.',
    esquema: esquemaHerramientaLsp,
    ejecutar: async (args: ArgumentosHerramientaLsp): Promise<string> => {
      // 1. Validar esquema
      const parseado = esquemaHerramientaLsp.safeParse(args)
      if (!parseado.success) {
        return `ERROR: Argumentos inválidos para 'lsp': ${parseado.error.message}`
      }

      const { operacion, ruta, linea, caracter, simbolo } = parseado.data

      // 2. Evaluar permisos de solo lectura
      const recurso = `${operacion}:${ruta ?? '*'}`
      const decision = evaluarOperacionPermiso({
        accion: 'lsp',
        recursos: recurso,
        reglasGlobales: opciones.reglasGlobales,
        reglasAgente: opciones.reglasAgente,
        aprobacionesGuardadas: opciones.aprobacionesGuardadas,
        directorioProyecto: opciones.directorioProyecto,
      })

      if (decision.efecto === 'denegar') {
        return `ERROR: Operación LSP '${operacion}' denegada por reglas de permisos para '${recurso}'.`
      }

      // 3. Ejecutar
      const posicion =
        linea !== undefined && caracter !== undefined
          ? { linea, caracter }
          : undefined

      return await opciones.gestorLsp.ejecutarOperacion(
        operacion,
        ruta,
        posicion,
        simbolo,
      )
    },
  }
}
