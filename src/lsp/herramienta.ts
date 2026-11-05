import { z } from 'zod'
import type { EntradaHerramienta } from '../core/registry.js'
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

export const esquemaJsonHerramientaLsp: Record<string, unknown> = {
  type: 'object',
  properties: {
    operacion: {
      type: 'string',
      enum: [
        'definition',
        'references',
        'documentSymbols',
        'workspaceSymbols',
        'hover',
        'diagnostics',
      ],
      description: 'Operación semántica a realizar sobre el archivo.',
    },
    ruta: {
      type: 'string',
      description: 'Ruta del archivo relativa al proyecto.',
    },
    linea: {
      type: 'number',
      description: 'Línea base cero para definition, references y hover.',
    },
    caracter: {
      type: 'number',
      description: 'Carácter base cero para definition, references y hover.',
    },
    simbolo: {
      type: 'string',
      description: 'Texto a buscar en workspaceSymbols.',
    },
  },
  required: ['operacion'],
}

export function recursoHerramientaLsp(
  argumentos: Record<string, unknown>,
): string {
  return `${String(argumentos.operacion ?? '')}:${String(argumentos.ruta ?? '*')}`
}

export interface OpcionesHerramientaLsp {
  gestorLsp: GestorLsp
  reglasGlobales?: readonly ReglaPermiso[] | undefined
  reglasAgente?: readonly ReglaPermiso[] | undefined
  aprobacionesGuardadas?: readonly ReglaPermiso[] | undefined
  directorioProyecto?: string | undefined
}

export function crearHerramientaLsp(
  opciones: OpcionesHerramientaLsp,
): EntradaHerramienta {
  return {
    nombre: 'lsp',
    descripcion:
      'Consulta información semántica de código mediante Language Server Protocol (definición, referencias, símbolos, hover, diagnósticos). Es de solo lectura.',
    esquema: esquemaJsonHerramientaLsp,
    accionPermiso: 'lsp',
    obtenerRecurso: recursoHerramientaLsp,
    admiteParalelo: true,
    ejecutar: async (args: Record<string, unknown>): Promise<string> => {
      // 1. Validar esquema
      const parseado = esquemaHerramientaLsp.safeParse(args)
      if (!parseado.success) {
        return `ERROR: Argumentos inválidos para 'lsp': ${parseado.error.message}`
      }

      const { operacion, ruta, linea, caracter, simbolo } =
        parseado.data as ArgumentosHerramientaLsp

      // 2. Evaluar permisos de solo lectura
      const decision = evaluarOperacionPermiso({
        accion: 'lsp',
        recursos: recursoHerramientaLsp(args),
        reglasGlobales: opciones.reglasGlobales,
        reglasAgente: opciones.reglasAgente,
        aprobacionesGuardadas: opciones.aprobacionesGuardadas,
        directorioProyecto: opciones.directorioProyecto,
      })

      if (decision.efecto === 'denegar') {
        return `ERROR: Operación LSP '${operacion}' denegada por reglas de permisos para '${decision.recurso}'.`
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
