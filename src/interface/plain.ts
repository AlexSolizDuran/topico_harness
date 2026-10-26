import type { ElementoVisual, EstadoSesionVisual } from './state.js'

export function formatearAvisoSesion(id: string | undefined): string {
  return id ? `[Sesión: ${id}]\n` : ''
}

export class RenderizadorLineaALinea {
  private bufferTexto = ''
  private escritor: (linea: string) => void

  constructor(
    escritor: (linea: string) => void = (l) => process.stdout.write(`${l}\n`),
  ) {
    this.escritor = escritor
  }

  mostrarPromptSistema(prompt: string): void {
    if (prompt) {
      this.escritor(`[Sistema]: ${prompt}`)
    }
  }

  mostrarMensajeUsuario(texto: string): void {
    this.escritor(`[Usuario]: ${texto}`)
  }

  mostrarDelta(delta: string): void {
    this.bufferTexto += delta
  }

  fijarMensajeAsistente(): void {
    if (this.bufferTexto.length > 0) {
      this.escritor(`[Asistente]: ${this.bufferTexto}`)
      this.bufferTexto = ''
    }
  }

  mostrarHerramienta(
    nombre: string,
    resultado: string,
    esError: boolean,
    truncado: boolean,
  ): void {
    this.fijarMensajeAsistente()

    const estadoEtiqueta = esError ? ' [ERROR]' : ''
    const truncadoEtiqueta = truncado ? ' [TRUNCADO]' : ''
    this.escritor(
      `[Herramienta: ${nombre}]${estadoEtiqueta}${truncadoEtiqueta}: ${resultado}`,
    )
  }

  mostrarDelegacion(
    subagente: string,
    pedido: string,
    resultado: string,
    esError: boolean,
    truncado: boolean,
  ): void {
    this.fijarMensajeAsistente()

    const estadoEtiqueta = esError ? ' [ERROR]' : ''
    const truncadoEtiqueta = truncado ? ' [TRUNCADO]' : ''
    this.escritor(
      `[Subagente: ${subagente}] (${pedido})${estadoEtiqueta}${truncadoEtiqueta}: ${resultado}`,
    )
  }

  mostrarAviso(texto: string): void {
    this.escritor(`[Aviso]: ${texto}`)
  }

  mostrarCancelado(): void {
    this.fijarMensajeAsistente()
    this.escritor('[Turno cancelado]')
  }
}

/**
 * Consume snapshots del estado visual y los traduce a líneas. Sirve para el
 * modo sin terminal interactiva, donde no hay redibujado sino append.
 */
export class RenderizadorProgreso {
  private readonly render: RenderizadorLineaALinea
  private elementosImpresos = 0
  private textoImpreso = 0
  private turnoActivo = false
  private promptMostrado = false

  constructor(render: RenderizadorLineaALinea) {
    this.render = render
  }

  private imprimirElemento(elemento: ElementoVisual): void {
    if (elemento.tipo === 'usuario') {
      this.render.mostrarMensajeUsuario(elemento.texto)
    } else if (elemento.tipo === 'herramienta') {
      this.render.mostrarHerramienta(
        elemento.nombre,
        elemento.resultado,
        elemento.esError,
        elemento.truncado,
      )
    } else if (elemento.tipo === 'delegacion') {
      this.render.mostrarDelegacion(
        elemento.subagente,
        elemento.pedido,
        elemento.resultado,
        elemento.esError,
        elemento.truncado,
      )
    } else if (elemento.tipo === 'aviso') {
      this.render.mostrarAviso(elemento.texto)
    } else if (elemento.tipo === 'asistente') {
      this.render.fijarMensajeAsistente()
      this.textoImpreso = 0
    }
  }

  actualizar(estado: EstadoSesionVisual): void {
    if (!this.promptMostrado && estado.promptSistema) {
      this.render.mostrarPromptSistema(estado.promptSistema)
      this.promptMostrado = true
    }

    while (this.elementosImpresos < estado.historial.length) {
      const elemento = estado.historial[this.elementosImpresos]
      this.elementosImpresos++
      if (elemento) {
        this.imprimirElemento(elemento)
      }
    }

    const streaming = estado.textoStreamingActual
    if (streaming.length > this.textoImpreso) {
      this.render.mostrarDelta(streaming.slice(this.textoImpreso))
      this.textoImpreso = streaming.length
    }

    if (this.turnoActivo && !estado.turnoEnCurso) {
      this.render.fijarMensajeAsistente()
      this.textoImpreso = 0
    }

    this.turnoActivo = estado.turnoEnCurso
  }
}
