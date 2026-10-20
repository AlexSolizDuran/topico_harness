import type {
  ConteoTokens,
  EventoProveedor,
  Mensaje,
  SolicitudHerramienta,
} from '../../types.js'
import { sanitizarTexto } from '../credentials.js'
import { ejecutarConReintentos, type OpcionesReintento } from '../retry.js'
import { leerSSE } from '../sse.js'
import {
  ErrorProveedor,
  type PeticionProveedor,
  type Proveedor,
} from '../types.js'

export interface OpcionesProveedorOpenAICompatible {
  nombre: string
  modelo: string
  baseUrl: string
  apiKey?: string | undefined
  cabecerasExtra?: Record<string, string> | undefined
  soportaHerramientas?: boolean | undefined
  maxTokensSalida?: number | undefined
  fetchImpl?: typeof fetch | undefined
  opcionesReintento?: OpcionesReintento | undefined
}

interface LlamadaAcumulada {
  id: string
  nombre: string
  argumentos: string
}

interface HerramientaOpenAI {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

interface MensajeOpenAI {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

function traducirMensaje(mensaje: Mensaje): MensajeOpenAI {
  if (mensaje.rol === 'tool') {
    return {
      role: 'tool',
      tool_call_id: mensaje.idLlamada ?? '',
      content: mensaje.resultado ?? '',
    }
  }

  if (mensaje.rol === 'assistant') {
    const traducido: MensajeOpenAI = {
      role: 'assistant',
      content: mensaje.contenido ?? null,
    }
    if (mensaje.llamadasHerramientas?.length) {
      traducido.tool_calls = mensaje.llamadasHerramientas.map((llamada) => ({
        id: llamada.id,
        type: 'function',
        function: {
          name: llamada.nombre,
          arguments: JSON.stringify(llamada.argumentos ?? {}),
        },
      }))
    }
    return traducido
  }

  return {
    role: mensaje.rol === 'system' ? 'system' : 'user',
    content: mensaje.contenido ?? '',
  }
}

function traducirMensajes(
  mensajes: Mensaje[],
  sistema?: string,
): MensajeOpenAI[] {
  const traducidos = mensajes.map(traducirMensaje)
  if (sistema && traducidos[0]?.role !== 'system') {
    return [{ role: 'system', content: sistema }, ...traducidos]
  }
  return traducidos
}

function traducirHerramientas(
  herramientas: PeticionProveedor['herramientas'],
): HerramientaOpenAI[] {
  return (herramientas ?? []).map((herramienta) => ({
    type: 'function',
    function: {
      name: herramienta.nombre,
      description: herramienta.descripcion,
      parameters: herramienta.esquema,
    },
  }))
}

function parsearArgumentos(texto: string): Record<string, unknown> {
  if (!texto.trim()) return {}
  try {
    const valor: unknown = JSON.parse(texto)
    if (typeof valor === 'object' && valor !== null && !Array.isArray(valor)) {
      return valor as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

function normalizarUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/chat/completions`
}

interface EstadoFlujo {
  acumuladas: Map<number, LlamadaAcumulada>
  tokens?: ConteoTokens | undefined
  razonFin?: string | undefined
}

function leerTokens(datos: Record<string, unknown>): ConteoTokens | undefined {
  if (typeof datos.usage !== 'object' || datos.usage === null) return undefined
  const uso = datos.usage as Record<string, unknown>
  const entrada =
    typeof uso.prompt_tokens === 'number' ? uso.prompt_tokens : undefined
  const salida =
    typeof uso.completion_tokens === 'number'
      ? uso.completion_tokens
      : undefined

  if (entrada === undefined && salida === undefined) return undefined
  return { entrada: entrada ?? 0, salida: salida ?? 0 }
}

function extraerOpcion(
  datos: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const choices = Array.isArray(datos.choices) ? datos.choices : []
  const eleccion = choices[0]
  if (typeof eleccion !== 'object' || eleccion === null) return undefined
  return eleccion as Record<string, unknown>
}

function construirLlamadas(
  acumuladas: Map<number, LlamadaAcumulada>,
): SolicitudHerramienta[] {
  return [...acumuladas.entries()]
    .sort(([a], [b]) => a - b)
    .map(([indice, llamada]) => ({
      id: llamada.id || `call_${indice}`,
      nombre: llamada.nombre,
      argumentos: parsearArgumentos(llamada.argumentos),
    }))
    .filter((llamada) => llamada.nombre.length > 0)
}

/**
 * Adaptador para las APIs compatibles con chat completions de OpenAI.
 * También cubre OpenRouter, que usa el mismo contrato con ids proveedor/modelo.
 */
export class ProveedorOpenAICompatible implements Proveedor {
  readonly nombre: string
  readonly modelo: string
  private readonly url: string
  private readonly apiKey: string
  private readonly cabecerasExtra: Record<string, string>
  private readonly soportaHerramientas: boolean
  private readonly maxTokensSalida?: number | undefined
  private readonly fetchImpl: typeof fetch
  private readonly opcionesReintento: OpcionesReintento

  constructor(opciones: OpcionesProveedorOpenAICompatible) {
    this.nombre = opciones.nombre
    this.modelo = opciones.modelo
    this.url = normalizarUrl(opciones.baseUrl)
    this.apiKey = opciones.apiKey ?? ''
    this.cabecerasExtra = opciones.cabecerasExtra ?? {}
    this.soportaHerramientas = opciones.soportaHerramientas ?? true
    this.maxTokensSalida = opciones.maxTokensSalida
    this.fetchImpl = opciones.fetchImpl ?? fetch
    this.opcionesReintento = opciones.opcionesReintento ?? {}
  }

  private construirCabeceras(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.cabecerasExtra,
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
    }
  }

  private limpiar(mensaje: string): string {
    return this.apiKey ? sanitizarTexto(mensaje, [this.apiKey]) : mensaje
  }

  private async abrirPeticion(
    cuerpo: Record<string, unknown>,
    senal?: AbortSignal,
  ): Promise<Response> {
    const respuesta = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: this.construirCabeceras(),
      body: JSON.stringify(cuerpo),
      ...(senal ? { signal: senal } : {}),
    })

    if (!respuesta.ok) {
      const detalle = await respuesta.text().catch(() => '')
      const mensaje = this.limpiar(
        `El provider respondió ${respuesta.status} ${respuesta.statusText}: ${detalle.slice(0, 1000)}`,
      )
      throw new ErrorProveedor(mensaje, {
        codigoEstado: respuesta.status,
        esTransitorio: respuesta.status === 429 || respuesta.status >= 500,
      })
    }

    return respuesta
  }

  private construirCuerpo(
    peticion: PeticionProveedor,
  ): Record<string, unknown> {
    const herramientas = traducirHerramientas(peticion.herramientas)
    const maxTokens = peticion.limiteTokens ?? this.maxTokensSalida
    return {
      model: this.modelo,
      messages: traducirMensajes(peticion.mensajes, peticion.sistema),
      stream: true,
      stream_options: { include_usage: true },
      ...(herramientas.length > 0 && this.soportaHerramientas
        ? { tools: herramientas }
        : {}),
      ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
    }
  }

  private acumularLlamada(
    acumuladas: Map<number, LlamadaAcumulada>,
    fragmento: Record<string, unknown>,
  ): void {
    const indice =
      typeof fragmento.index === 'number' ? fragmento.index : acumuladas.size
    const actual = acumuladas.get(indice) ?? {
      id: '',
      nombre: '',
      argumentos: '',
    }

    const funcion =
      typeof fragmento.function === 'object' && fragmento.function !== null
        ? (fragmento.function as Record<string, unknown>)
        : {}

    if (typeof fragmento.id === 'string' && fragmento.id) {
      actual.id = fragmento.id
    }
    if (typeof funcion.name === 'string' && funcion.name) {
      actual.nombre += funcion.name
    }
    if (typeof funcion.arguments === 'string') {
      actual.argumentos += funcion.arguments
    }

    acumuladas.set(indice, actual)
  }

  private validarError(datos: Record<string, unknown>): void {
    if (!datos.error) return
    const error = datos.error as { message?: unknown }
    const detalle =
      typeof error.message === 'string'
        ? error.message
        : 'Error desconocido del provider'
    throw new ErrorProveedor(this.limpiar(detalle))
  }

  private acumularFragmentos(
    delta: Record<string, unknown>,
    acumuladas: Map<number, LlamadaAcumulada>,
  ): void {
    if (!Array.isArray(delta.tool_calls)) return
    for (const fragmento of delta.tool_calls) {
      if (typeof fragmento === 'object' && fragmento !== null) {
        this.acumularLlamada(acumuladas, fragmento as Record<string, unknown>)
      }
    }
  }

  private procesarEvento(
    datos: Record<string, unknown>,
    estado: EstadoFlujo,
  ): string[] {
    this.validarError(datos)

    const tokens = leerTokens(datos)
    if (tokens) {
      estado.tokens = tokens
    }

    const opcion = extraerOpcion(datos)
    if (!opcion) return []

    const delta =
      typeof opcion.delta === 'object' && opcion.delta !== null
        ? (opcion.delta as Record<string, unknown>)
        : {}

    this.acumularFragmentos(delta, estado.acumuladas)

    if (typeof opcion.finish_reason === 'string') {
      estado.razonFin = opcion.finish_reason
    }

    return typeof delta.content === 'string' && delta.content.length > 0
      ? [delta.content]
      : []
  }

  async *enviar(
    peticion: PeticionProveedor,
  ): AsyncGenerator<EventoProveedor, void, unknown> {
    const cuerpo = this.construirCuerpo(peticion)
    const respuesta = await ejecutarConReintentos(
      () => this.abrirPeticion(cuerpo, peticion.senalCancelacion),
      this.opcionesReintento,
    )

    if (!respuesta.body) {
      throw new ErrorProveedor(
        'El provider no devolvió un cuerpo de respuesta.',
      )
    }

    const estado: EstadoFlujo = { acumuladas: new Map() }

    for await (const payload of leerSSE(respuesta.body)) {
      let datos: Record<string, unknown>
      try {
        datos = JSON.parse(payload) as Record<string, unknown>
      } catch {
        continue
      }

      for (const delta of this.procesarEvento(datos, estado)) {
        yield { tipo: 'texto', delta }
      }
    }

    for (const llamada of construirLlamadas(estado.acumuladas)) {
      yield {
        tipo: 'solicitud_herramienta',
        id: llamada.id,
        nombre: llamada.nombre,
        argumentos: llamada.argumentos,
      }
    }

    const interrumpido = estado.razonFin === 'length'
    yield {
      tipo: 'fin',
      razon: interrumpido ? 'interrumpido' : 'completado',
      motivo: interrumpido ? 'max_tokens' : undefined,
      tokens: estado.tokens,
    }
  }
}

export function crearProveedorOpenAICompatible(
  opciones: OpcionesProveedorOpenAICompatible,
): ProveedorOpenAICompatible {
  return new ProveedorOpenAICompatible(opciones)
}
