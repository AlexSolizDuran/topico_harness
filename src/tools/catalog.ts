import {
  type EntradaHerramienta,
  RegistroHerramientas,
} from '../core/registry.js'
import { crearHerramientaEdicion } from './edit.js'
import { crearHerramientaGlob } from './glob.js'
import { crearHerramientaGrep } from './grep.js'
import { crearHerramientaLectura } from './read.js'
import { crearHerramientaShell } from './shell.js'
import { crearHerramientaEscritura } from './write.js'

export class ErrorEsquemaRequerido extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorEsquemaRequerido'
  }
}

/**
 * Valida que una herramienta declare un esquema estructurado antes de darla de alta.
 */
export function registrarHerramientaConValidacion(
  registro: RegistroHerramientas,
  herramienta: EntradaHerramienta,
): void {
  if (
    !herramienta.esquema ||
    typeof herramienta.esquema !== 'object' ||
    Object.keys(herramienta.esquema).length === 0
  ) {
    throw new ErrorEsquemaRequerido(
      `La herramienta '${herramienta.nombre}' no declara un esquema y no puede ser habilitada.`,
    )
  }
  registro.registrar(herramienta)
}

export interface OpcionesCatalogo {
  directorioProyecto?: string | undefined
  plataforma?: NodeJS.Platform | undefined
  maximoContenido?: number | undefined
}

/**
 * Instancia y registra las herramientas estándar del catálogo de acuerdo a la plataforma activa.
 */
export function crearCatalogoPorDefecto(
  opciones: OpcionesCatalogo = {},
): RegistroHerramientas {
  const registro = new RegistroHerramientas()
  const dir = opciones.directorioProyecto ?? process.cwd()

  registrarHerramientaConValidacion(
    registro,
    crearHerramientaLectura(dir, opciones.maximoContenido),
  )
  registrarHerramientaConValidacion(registro, crearHerramientaEscritura(dir))
  registrarHerramientaConValidacion(registro, crearHerramientaEdicion(dir))
  registrarHerramientaConValidacion(registro, crearHerramientaGlob(dir))
  registrarHerramientaConValidacion(
    registro,
    crearHerramientaGrep(dir, opciones.maximoContenido),
  )

  const toolShell = crearHerramientaShell({
    plataforma: opciones.plataforma,
    directorioProyecto: dir,
    maximoContenido: opciones.maximoContenido,
  })

  if (toolShell) {
    registrarHerramientaConValidacion(registro, toolShell)
  }

  return registro
}
