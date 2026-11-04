import type { Proveedor } from '../provider/types.js'
import type { Mensaje } from '../types.js'
import type { EntradaMemoria } from './types.js'

export interface OpcionesExtraccion {
  proveedor?: Proveedor | undefined
  origen?: string | undefined
  fecha?: string | undefined
}

export interface ResultadoExtraccion {
  entradas: EntradaMemoria[]
  error?: string | undefined
}

/**
 * Extrae hechos concretos no deducibles a partir del historial o transcript de la sesión.
 * Si ocurre un error, no propaga la excepción sino que devuelve el fallo registrado,
 * permitiendo que el cierre de sesión continúe limpiamente.
 */
export async function extraerHechosDeSesion(
  mensajes: Mensaje[],
  opciones: OpcionesExtraccion = {},
): Promise<ResultadoExtraccion> {
  if (mensajes.length === 0) {
    return { entradas: [] }
  }

  try {
    if (opciones.proveedor) {
      const prompt =
        'Analiza la sesión e identifica únicamente convenciones, decisiones técnicas y errores ya descartados que NO sean evidentes ni deducibles leyendo el código fuente. Devuelve solo los hechos relevantes, uno por línea.'

      let salida = ''
      const flujo = opciones.proveedor.enviar({
        mensajes: [...mensajes, { rol: 'user', contenido: prompt }],
      })

      for await (const ev of flujo) {
        if (ev.tipo === 'texto') salida += ev.delta
      }

      const lineas = salida
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.startsWith('- ') || l.startsWith('* '))

      const fecha = opciones.fecha ?? new Date().toISOString().slice(0, 10)
      const entradas: EntradaMemoria[] = lineas.map((linea, i) => {
        const texto = linea.replace(/^[-*]\s*/, '').trim()
        return {
          id: `hecho_${Date.now()}_${i + 1}`,
          titulo: texto,
          contenido: texto,
          origen: opciones.origen ?? 'sesion',
          fecha,
        }
      })

      return { entradas: filtrarObviedadesYDeducibles(entradas) }
    }

    // Heurística de respaldo cuando no hay proveedor explícito:
    // Filtra mensajes de decisiones y convenciones explícitas
    return { entradas: extraerPorHeuristica(mensajes, opciones) }
  } catch (error) {
    return {
      entradas: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

function extraerPorHeuristica(
  mensajes: Mensaje[],
  opciones: OpcionesExtraccion,
): EntradaMemoria[] {
  const entradas: EntradaMemoria[] = []
  const fecha = opciones.fecha ?? new Date().toISOString().slice(0, 10)

  for (let i = 0; i < mensajes.length; i++) {
    const msg = mensajes[i]
    if (!msg?.contenido) continue

    const texto = msg.contenido
    // Detección de convenciones o decisiones no obvias
    if (
      texto.includes('convención:') ||
      texto.includes('decision:') ||
      texto.includes('decisión:') ||
      texto.includes('acordado:')
    ) {
      entradas.push({
        id: `hecho_${Date.now()}_${entradas.length + 1}`,
        titulo: texto.trim(),
        contenido: texto.trim(),
        origen: opciones.origen ?? 'sesion',
        fecha,
      })
    }
  }

  return filtrarObviedadesYDeducibles(entradas)
}

function filtrarObviedadesYDeducibles(
  entradas: EntradaMemoria[],
): EntradaMemoria[] {
  return entradas.filter((e) => {
    const t = e.titulo.toLowerCase()
    // Descartar obviedades y acciones triviales del usuario
    if (
      t.includes('leí el archivo') ||
      t.includes('el usuario pidió') ||
      t.includes('ejecuté el comando') ||
      t.includes('el archivo existe')
    ) {
      return false
    }
    // Descartar lo que se deduce directamente de la estructura del código
    if (
      t.includes('el paquete está en package.json') ||
      t.includes('exporta la función')
    ) {
      return false
    }
    return true
  })
}
