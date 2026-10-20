/**
 * Parser de Server-Sent Events para los adaptadores HTTP.
 * Acumula el buffer y solo procesa líneas completas, porque un chunk puede
 * cortar un `data:` al medio.
 */
export async function* leerSSE(
  cuerpo: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, unknown> {
  const lector = cuerpo.getReader()
  const decodificador = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await lector.read()
      if (done) break

      buffer += decodificador.decode(value, { stream: true })

      let salto = buffer.indexOf('\n')
      while (salto !== -1) {
        const linea = buffer.slice(0, salto).replace(/\r$/, '')
        buffer = buffer.slice(salto + 1)

        const payload = extraerPayload(linea)
        if (payload === '[DONE]') return
        if (payload !== undefined) yield payload

        salto = buffer.indexOf('\n')
      }
    }

    buffer += decodificador.decode()
    const payloadFinal = extraerPayload(buffer.replace(/\r$/, ''))
    if (payloadFinal !== undefined && payloadFinal !== '[DONE]') {
      yield payloadFinal
    }
  } finally {
    lector.releaseLock()
  }
}

function extraerPayload(linea: string): string | undefined {
  if (linea.length === 0 || linea.startsWith(':')) return undefined
  if (!linea.startsWith('data:')) return undefined

  const payload = linea.slice('data:'.length).trimStart()
  if (payload.length === 0) return undefined
  return payload
}
