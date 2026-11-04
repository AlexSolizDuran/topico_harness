import type { Mensaje } from '../types.js'

export const PASOS_SIN_ESCRITURA_POR_DEFECTO = 5

export type TipoRecordatorioSistema =
  | 'verificar_edicion'
  | 'reinyectar_objetivo'
  | 'post_compactacion'

export interface OpcionesGestorRecordatorios {
  pasosSinEscrituraMax?: number | undefined
  objetivoOriginal?: string | undefined
}

export class GestorRecordatorios {
  private pasosSinEscrituraMax: number
  private objetivoOriginal?: string | undefined
  private pasosSinEscritura = 0
  private ultimoRecordatorio?: TipoRecordatorioSistema | undefined
  private recordatoriosEnEsteTurno = new Set<TipoRecordatorioSistema>()

  constructor(opciones: OpcionesGestorRecordatorios = {}) {
    this.pasosSinEscrituraMax =
      opciones.pasosSinEscrituraMax ?? PASOS_SIN_ESCRITURA_POR_DEFECTO
    this.objetivoOriginal = opciones.objetivoOriginal
  }

  establecerObjetivoOriginal(objetivo: string | undefined): void {
    this.objetivoOriginal = objetivo
  }

  obtenerObjetivoOriginal(): string | undefined {
    return this.objetivoOriginal
  }

  iniciarTurno(): void {
    this.recordatoriosEnEsteTurno.clear()
  }

  /**
   * Genera el recordatorio tras una compactación previa.
   */
  crearRecordatorioPostCompactacion(): Mensaje | undefined {
    if (
      this.ultimoRecordatorio === 'post_compactacion' ||
      this.recordatoriosEnEsteTurno.has('post_compactacion')
    ) {
      return undefined
    }

    this.ultimoRecordatorio = 'post_compactacion'
    this.recordatoriosEnEsteTurno.add('post_compactacion')

    const objetivo = this.objetivoOriginal
      ? ` El objetivo original sigue vigente: "${this.objetivoOriginal}".`
      : ' El objetivo original sigue vigente.'

    return {
      rol: 'system',
      contenido: `Recordatorio de sistema: el historial previo fue resumido para conservar presupuesto.${objetivo}`,
    }
  }

  /**
   * Evalúa el paso y devuelve un recordatorio si corresponde.
   */
  evaluarPaso(huboEscritura: boolean): Mensaje | undefined {
    if (huboEscritura) {
      this.pasosSinEscritura = 0
      if (
        this.ultimoRecordatorio === 'verificar_edicion' ||
        this.recordatoriosEnEsteTurno.has('verificar_edicion')
      ) {
        return undefined
      }

      this.ultimoRecordatorio = 'verificar_edicion'
      this.recordatoriosEnEsteTurno.add('verificar_edicion')
      return {
        rol: 'system',
        contenido:
          'Recordatorio de sistema: se realizaron modificaciones de código o archivos. Se sugiere verificar el cambio.',
      }
    }

    this.pasosSinEscritura++
    if (this.pasosSinEscritura >= this.pasosSinEscrituraMax) {
      if (
        this.ultimoRecordatorio === 'reinyectar_objetivo' ||
        this.recordatoriosEnEsteTurno.has('reinyectar_objetivo')
      ) {
        return undefined
      }

      this.ultimoRecordatorio = 'reinyectar_objetivo'
      this.recordatoriosEnEsteTurno.add('reinyectar_objetivo')
      const obj = this.objetivoOriginal ?? 'tarea solicitada'
      return {
        rol: 'system',
        contenido: `Recordatorio de sistema: han transcurrido ${this.pasosSinEscritura} pasos sin escrituras. Objetivo original: "${obj}".`,
      }
    }

    return undefined
  }

  /**
   * Inserta un recordatorio en el historial respetando estrictamente la atomicidad
   * entre solicitudes de herramienta y sus respuestas.
   */
  inyectarEnHistorial(historial: Mensaje[], recordatorio: Mensaje): void {
    let ultimoToolCallIndex = -1
    for (let i = historial.length - 1; i >= 0; i--) {
      const msg = historial[i]
      if (
        msg &&
        msg.rol === 'assistant' &&
        (msg.llamadasHerramientas?.length ?? 0) > 0
      ) {
        ultimoToolCallIndex = i
        break
      }
    }

    if (ultimoToolCallIndex === -1) {
      historial.push(recordatorio)
      return
    }

    // Si hay una llamada pendiente de respuestas, no podemos insertar después de ella
    // hasta que todas sus respuestas estén presentes.
    const llamada = historial[ultimoToolCallIndex]
    const idsEsperados = new Set(
      llamada?.llamadasHerramientas?.map((l) => l.id) ?? [],
    )

    for (let j = ultimoToolCallIndex + 1; j < historial.length; j++) {
      const msg = historial[j]
      if (msg && msg.rol === 'tool' && msg.idLlamada) {
        idsEsperados.delete(msg.idLlamada)
      }
    }

    if (idsEsperados.size > 0) {
      // Inserción ANTES de la llamada para no partir la secuencia
      historial.splice(ultimoToolCallIndex, 0, recordatorio)
    } else {
      // Todas respondidas: seguro al final
      historial.push(recordatorio)
    }
  }
}
