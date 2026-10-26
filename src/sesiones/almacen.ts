import { randomBytes } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { Mensaje } from '../types.js'
import {
  ErrorSesion,
  esIdSesionValido,
  parsearRegistro,
  type RegistroSesion,
  reproducirRegistros,
  type SesionCargada,
  type SesionMetadata,
  sanearMensajes,
  serializarRegistro,
  validarMetadata,
} from './formato.js'

export const MAXIMO_SESIONES_POR_DEFECTO = 50

export interface OpcionesAlmacenSesiones {
  directorioProyecto: string
  maximo?: number | undefined
  ahora?: (() => Date) | undefined
  generarId?: (() => string) | undefined
}

export interface OpcionesCrearSesion {
  modelo: string
  agente: string
  padre?: string | undefined
  desdeTurno?: number | undefined
}

export interface ResultadoBusquedaSesion {
  sesion: SesionMetadata
  coincidencias: number
  fragmento: string
}

function generarIdPorDefecto(ahora: Date): string {
  const dos = (n: number): string => String(n).padStart(2, '0')
  const fecha = `${ahora.getFullYear()}${dos(ahora.getMonth() + 1)}${dos(ahora.getDate())}`
  const hora = `${dos(ahora.getHours())}${dos(ahora.getMinutes())}${dos(ahora.getSeconds())}`
  return `${fecha}-${hora}-${randomBytes(2).toString('hex')}`
}

function textoBuscable(mensajes: readonly Mensaje[]): string {
  return mensajes
    .map((mensaje) => {
      const partes = [mensaje.contenido ?? '', mensaje.resultado ?? '']
      for (const llamada of mensaje.llamadasHerramientas ?? []) {
        partes.push(llamada.nombre, JSON.stringify(llamada.argumentos))
      }
      return partes.join('\n')
    })
    .join('\n')
}

/**
 * Guarda sesiones como registros de solo agregado dentro del proyecto.
 * Un proceso por proyecto es el escritor único; no hay bloqueo entre procesos.
 */
export class AlmacenSesiones {
  private readonly directorioProyecto: string
  private readonly raiz: string
  private readonly maximo: number
  private readonly ahora: () => Date
  private readonly generarId: (ahora: Date) => string

  constructor(opciones: OpcionesAlmacenSesiones) {
    this.directorioProyecto = opciones.directorioProyecto
    this.raiz = join(opciones.directorioProyecto, '.harness', 'sesiones')
    this.maximo = opciones.maximo ?? MAXIMO_SESIONES_POR_DEFECTO
    this.ahora = opciones.ahora ?? (() => new Date())
    this.generarId =
      opciones.generarId ?? ((ahora) => generarIdPorDefecto(ahora))
  }

  obtenerDirectorioProyecto(): string {
    return this.directorioProyecto
  }

  obtenerRaiz(): string {
    return this.raiz
  }

  rutaSesion(id: string): string {
    if (!esIdSesionValido(id)) {
      throw new ErrorSesion(`El identificador de sesión '${id}' no es válido.`)
    }
    return join(this.raiz, id)
  }

  rutaEventos(id: string): string {
    return join(this.rutaSesion(id), 'eventos.jsonl')
  }

  rutaMetadata(id: string): string {
    return join(this.rutaSesion(id), 'sesion.json')
  }

  existe(id: string): boolean {
    try {
      return existsSync(this.rutaMetadata(id))
    } catch {
      return false
    }
  }

  crear(opciones: OpcionesCrearSesion): SesionMetadata {
    mkdirSync(this.raiz, { recursive: true, mode: 0o700 })
    const instante = this.ahora()
    let id = this.generarId(instante)
    for (let intento = 0; intento < 5 && this.existe(id); intento++) {
      id = this.generarId(this.ahora())
    }
    if (this.existe(id)) {
      throw new ErrorSesion(
        'No se pudo generar un identificador de sesión libre.',
      )
    }

    const metadata: SesionMetadata = {
      id,
      creadaEn: instante.toISOString(),
      actualizadaEn: instante.toISOString(),
      directorio: this.directorioProyecto,
      modelo: opciones.modelo,
      agente: opciones.agente,
      mensajes: 0,
      ...(opciones.padre ? { padre: opciones.padre } : {}),
      ...(opciones.desdeTurno !== undefined
        ? { desdeTurno: opciones.desdeTurno }
        : {}),
    }
    mkdirSync(this.rutaSesion(id), { recursive: true, mode: 0o700 })
    this.escribirMetadata(metadata)
    writeFileSync(this.rutaEventos(id), '', {
      encoding: 'utf-8',
      mode: 0o600,
    })
    this.podar(id)
    return metadata
  }

  cargar(id: string): SesionCargada {
    if (!esIdSesionValido(id) || !this.existe(id)) {
      throw new ErrorSesion(`La sesión '${id}' no existe.`)
    }
    const metadata = validarMetadata(
      JSON.parse(readFileSync(this.rutaMetadata(id), 'utf-8')),
      id,
    )
    return { metadata, mensajes: this.leerMensajes(id) }
  }

  listar(): SesionMetadata[] {
    if (!existsSync(this.raiz)) return []
    const sesiones: SesionMetadata[] = []
    for (const entrada of readdirSync(this.raiz, { withFileTypes: true })) {
      if (!entrada.isDirectory() || !esIdSesionValido(entrada.name)) continue
      try {
        sesiones.push(
          validarMetadata(
            JSON.parse(readFileSync(this.rutaMetadata(entrada.name), 'utf-8')),
            entrada.name,
          ),
        )
      } catch {
        // Una sesión corrupta no impide listar las demás.
      }
    }
    return sesiones.sort((a, b) =>
      b.actualizadaEn.localeCompare(a.actualizadaEn),
    )
  }

  ultima(directorioProyecto?: string): SesionMetadata | undefined {
    return this.listar().find(
      (sesion) =>
        !directorioProyecto || sesion.directorio === directorioProyecto,
    )
  }

  guardarTurno(
    id: string,
    estado: 'completado' | 'cancelado' | 'fallido',
    mensajes: readonly Mensaje[],
    credenciales: readonly string[] = [],
  ): void {
    this.agregarRegistro(id, {
      tipo: 'turno',
      estado,
      mensajes: sanearMensajes(mensajes, credenciales),
    })
  }

  guardarCompactacion(
    id: string,
    mensajes: readonly Mensaje[],
    credenciales: readonly string[] = [],
  ): void {
    this.agregarRegistro(id, {
      tipo: 'compactacion',
      mensajes: sanearMensajes(mensajes, credenciales),
    })
  }

  /**
   * Crea una sesión nueva con el historial de `id` hasta después del turno
   * `desdeTurno` (0 = antes de cualquier turno). La rama se guarda como una
   * compactación inicial, así el historial reproducido es exactamente la base.
   */
  ramificar(id: string, desdeTurno: number): SesionCargada {
    if (!Number.isInteger(desdeTurno) || desdeTurno < 0) {
      throw new ErrorSesion(
        `El turno de origen '${desdeTurno}' no es un número entero mayor o igual que cero.`,
      )
    }
    const cargada = this.cargar(id)
    const registros = this.leerRegistros(id)
    const hasta: RegistroSesion[] = []
    let turnos = 0
    for (const registro of registros) {
      if (turnos >= desdeTurno) break
      if (registro.tipo === 'turno') turnos++
      hasta.push(registro)
    }
    if (desdeTurno > turnos) {
      throw new ErrorSesion(
        `La sesión '${id}' no tiene ${desdeTurno} turnos guardados (tiene ${turnos}).`,
      )
    }

    const nueva = this.crear({
      modelo: cargada.metadata.modelo,
      agente: cargada.metadata.agente,
      padre: id,
      desdeTurno,
    })
    const mensajes = reproducirRegistros(hasta)
    if (mensajes.length > 0) {
      this.guardarCompactacion(nueva.id, mensajes)
    }
    return this.cargar(nueva.id)
  }

  /** Busca texto en el historial de las sesiones del proyecto. */
  buscar(texto: string): ResultadoBusquedaSesion[] {
    const aguja = texto.trim().toLowerCase()
    if (!aguja) {
      throw new ErrorSesion('El texto de búsqueda no puede estar vacío.')
    }

    const resultados: ResultadoBusquedaSesion[] = []
    for (const sesion of this.listar()) {
      let plano: string
      try {
        plano = textoBuscable(this.leerMensajes(sesion.id))
      } catch {
        continue
      }
      const indice = plano.toLowerCase().indexOf(aguja)
      if (indice === -1) continue
      const coincidencias = plano.toLowerCase().split(aguja).length - 1
      const inicio = Math.max(0, indice - 40)
      const fragmento = plano
        .slice(inicio, indice + aguja.length + 40)
        .replace(/\s+/g, ' ')
        .trim()
      resultados.push({ sesion, coincidencias, fragmento })
    }
    return resultados
  }

  actualizarMetadata(
    id: string,
    cambios: Partial<Pick<SesionMetadata, 'modelo' | 'agente'>>,
  ): SesionMetadata {
    const actual = validarMetadata(
      JSON.parse(readFileSync(this.rutaMetadata(id), 'utf-8')),
      id,
    )
    const actualizada: SesionMetadata = {
      ...actual,
      ...cambios,
      actualizadaEn: this.ahora().toISOString(),
    }
    this.escribirMetadata(actualizada)
    return actualizada
  }

  private agregarRegistro(id: string, registro: RegistroSesion): void {
    const ruta = this.rutaEventos(id)
    mkdirSync(this.rutaSesion(id), { recursive: true, mode: 0o700 })
    appendFileSync(ruta, `${serializarRegistro(registro)}\n`, {
      encoding: 'utf-8',
      mode: 0o600,
    })
    try {
      const metadata = validarMetadata(
        JSON.parse(readFileSync(this.rutaMetadata(id), 'utf-8')),
        id,
      )
      const mensajes =
        registro.tipo === 'turno'
          ? metadata.mensajes + registro.mensajes.length
          : registro.mensajes.length
      this.escribirMetadata({
        ...metadata,
        mensajes,
        actualizadaEn: this.ahora().toISOString(),
      })
    } catch {
      // Si los metadatos no se pueden actualizar, el registro ya quedó escrito.
    }
  }

  private escribirMetadata(metadata: SesionMetadata): void {
    writeFileSync(
      this.rutaMetadata(metadata.id),
      `${JSON.stringify(metadata, null, 2)}\n`,
      { encoding: 'utf-8', mode: 0o600 },
    )
  }

  private leerRegistros(id: string): RegistroSesion[] {
    const ruta = this.rutaEventos(id)
    if (!existsSync(ruta)) return []

    const lineas = readFileSync(ruta, 'utf-8')
      .split('\n')
      .map((linea, indice) => ({ linea, numero: indice + 1 }))
      .filter((item) => item.linea.trim() !== '')

    const registros: RegistroSesion[] = []
    for (let i = 0; i < lineas.length; i++) {
      const item = lineas[i]
      if (!item) continue
      const registro = parsearRegistro(item.linea)
      if (!registro) {
        if (i === lineas.length - 1) break
        throw new ErrorSesion(
          `La sesión '${id}' tiene un registro inválido en la línea ${item.numero}.`,
        )
      }
      registros.push(registro)
    }
    return registros
  }

  private leerMensajes(id: string): Mensaje[] {
    return reproducirRegistros(this.leerRegistros(id))
  }

  private podar(activa: string): void {
    if (this.maximo <= 0) return
    const todas = this.listar()
    if (todas.length <= this.maximo) return

    const otras = todas.filter((sesion) => sesion.id !== activa)
    const conservar = new Set([
      activa,
      ...otras.slice(0, Math.max(0, this.maximo - 1)).map((s) => s.id),
    ])
    for (const sesion of todas) {
      if (conservar.has(sesion.id)) continue
      try {
        rmSync(this.rutaSesion(sesion.id), { recursive: true, force: true })
      } catch {
        // La poda es best-effort: no impide seguir trabajando.
      }
    }
  }
}
