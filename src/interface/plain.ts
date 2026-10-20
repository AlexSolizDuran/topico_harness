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
    // En streaming se acumula o se muestra directo si termina en salto
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

  mostrarAviso(texto: string): void {
    this.escritor(`[Aviso]: ${texto}`)
  }

  mostrarCancelado(): void {
    this.fijarMensajeAsistente()
    this.escritor('[Turno cancelado]')
  }
}
