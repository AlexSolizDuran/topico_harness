import type { EntradaMemoria } from './types.js'

export const ENCABEZADO_MEMORIA = '# MEMORIA APRENDIDA DEL PROYECTO'
export const MARCADOR_AVISO_MEMORIA =
  '[Aviso: La memoria contiene hechos aprendidos en sesiones previas, no comprobados en este turno]'

export const ENCABEZADO_PREFERENCIAS_USUARIO =
  '# PREFERENCIAS DE USUARIO (Memoria personal)'

export interface OpcionesInyeccionMemoria {
  memoriaProyecto?: EntradaMemoria[] | undefined
  memoriaUsuario?: EntradaMemoria[] | undefined
}

/**
 * Formatea las entradas de memoria como un bloque de sistema estructurado,
 * identificando claramente origen y fecha, y manteniendo separadas las
 * preferencias del usuario de los hechos del proyecto.
 */
export function formatearBloqueMemoria(
  opciones: OpcionesInyeccionMemoria,
): string | undefined {
  const bloques: string[] = []

  const activasProyecto =
    opciones.memoriaProyecto?.filter((e) => !e.obsoleta) ?? []
  if (activasProyecto.length > 0) {
    const lineas: string[] = [ENCABEZADO_MEMORIA, MARCADOR_AVISO_MEMORIA]
    for (const entrada of activasProyecto) {
      const metaPartes: string[] = []
      if (entrada.fecha) metaPartes.push(entrada.fecha)
      if (entrada.origen) metaPartes.push(`origen: ${entrada.origen}`)
      const meta = metaPartes.length > 0 ? `[${metaPartes.join(' | ')}] ` : ''

      lineas.push(`- ${meta}${entrada.titulo}`)
    }
    bloques.push(lineas.join('\n'))
  }

  const activasUsuario =
    opciones.memoriaUsuario?.filter((e) => !e.obsoleta) ?? []
  if (activasUsuario.length > 0) {
    const lineas: string[] = [
      ENCABEZADO_PREFERENCIAS_USUARIO,
      '[Preferencia de usuario: no sobrescribe hechos del proyecto]',
    ]
    for (const entrada of activasUsuario) {
      lineas.push(`- [Preferencia] ${entrada.titulo}`)
    }
    bloques.push(lineas.join('\n'))
  }

  if (bloques.length === 0) {
    return undefined
  }

  return bloques.join('\n\n')
}
