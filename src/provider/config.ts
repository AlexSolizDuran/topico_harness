import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export class ErrorConfiguracion extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorConfiguracion'
  }
}

export interface ModeloConfigurado {
  id: string
  soportaHerramientas?: boolean | undefined
  ventanaContexto?: number | undefined
  maxTokensSalida?: number | undefined
}

export interface ConfiguracionProveedor {
  tipo: string
  baseUrl: string
  variableApiKey?: string | undefined
  apiKey?: string | undefined
  cabecerasExtra?: Record<string, string> | undefined
  modelos: ModeloConfigurado[]
}

export interface ConfiguracionSesiones {
  guardar?: boolean | undefined
  maximo?: number | undefined
}

export interface ConfiguracionHarness {
  proveedorPorDefecto?: string | undefined
  modeloPorDefecto?: string | undefined
  sesiones?: ConfiguracionSesiones | undefined
  proveedores: Record<string, ConfiguracionProveedor>
}

export interface OpcionesCargarConfig {
  directorioProyecto?: string | undefined
  directorioGlobal?: string | undefined
  entorno?: NodeJS.ProcessEnv | undefined
}

export interface ModeloResuelto {
  proveedorId: string
  proveedor: ConfiguracionProveedor
  modelo: ModeloConfigurado
}

const MODELO_POR_DEFECTO = 'modelo-desconocido'

/** Ruta del config global, fuera del proyecto para que las herramientas no puedan leerlo. */
export function rutaConfigGlobal(
  plataforma: NodeJS.Platform = process.platform,
  entorno: NodeJS.ProcessEnv = process.env,
): string {
  if (plataforma === 'win32') {
    const appData = entorno.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
    return join(appData, 'harness', 'config.json')
  }
  const configHome = entorno.XDG_CONFIG_HOME ?? join(homedir(), '.config')
  return join(configHome, 'harness', 'config.json')
}

export function rutaConfigProyecto(directorioProyecto: string): string {
  return join(directorioProyecto, '.harness', 'config.json')
}

function leerConfig(ruta: string): ConfiguracionHarness | undefined {
  let texto: string
  try {
    texto = readFileSync(ruta, 'utf-8')
  } catch {
    return undefined
  }

  let datos: unknown
  try {
    datos = JSON.parse(texto)
  } catch {
    throw new ErrorConfiguracion(
      `El archivo de configuración no es JSON válido: ${ruta}`,
    )
  }

  return validarConfig(datos, ruta)
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function validarCabeceras(
  valor: unknown,
  ruta: string,
): Record<string, string> | undefined {
  if (valor === undefined) return undefined
  if (!esObjeto(valor)) {
    throw new ErrorConfiguracion(
      `'cabecerasExtra' debe ser un objeto en ${ruta}`,
    )
  }
  const cabeceras: Record<string, string> = {}
  for (const [clave, contenido] of Object.entries(valor)) {
    if (typeof contenido !== 'string') {
      throw new ErrorConfiguracion(
        `La cabecera '${clave}' debe ser texto en ${ruta}`,
      )
    }
    cabeceras[clave] = contenido
  }
  return cabeceras
}

function validarModelo(
  modelo: unknown,
  indice: number,
  ruta: string,
): ModeloConfigurado {
  if (!esObjeto(modelo) || typeof modelo.id !== 'string' || !modelo.id) {
    throw new ErrorConfiguracion(
      `El modelo ${indice + 1} no declara un 'id' válido en ${ruta}`,
    )
  }
  if (
    modelo.ventanaContexto !== undefined &&
    (typeof modelo.ventanaContexto !== 'number' ||
      !Number.isFinite(modelo.ventanaContexto) ||
      modelo.ventanaContexto <= 0)
  ) {
    throw new ErrorConfiguracion(
      `El modelo '${modelo.id}' declara una 'ventanaContexto' inválida en ${ruta}`,
    )
  }
  if (
    modelo.soportaHerramientas !== undefined &&
    typeof modelo.soportaHerramientas !== 'boolean'
  ) {
    throw new ErrorConfiguracion(
      `El modelo '${modelo.id}' declara 'soportaHerramientas' inválido en ${ruta}`,
    )
  }
  if (
    modelo.maxTokensSalida !== undefined &&
    (typeof modelo.maxTokensSalida !== 'number' ||
      !Number.isInteger(modelo.maxTokensSalida) ||
      modelo.maxTokensSalida <= 0)
  ) {
    throw new ErrorConfiguracion(
      `El modelo '${modelo.id}' declara 'maxTokensSalida' inválido en ${ruta}`,
    )
  }

  return {
    id: modelo.id,
    ...(modelo.soportaHerramientas !== undefined
      ? { soportaHerramientas: modelo.soportaHerramientas }
      : {}),
    ...(modelo.ventanaContexto !== undefined
      ? { ventanaContexto: modelo.ventanaContexto }
      : {}),
    ...(modelo.maxTokensSalida !== undefined
      ? { maxTokensSalida: modelo.maxTokensSalida }
      : {}),
  }
}

function validarModelos(valor: unknown, ruta: string): ModeloConfigurado[] {
  if (!Array.isArray(valor) || valor.length === 0) {
    throw new ErrorConfiguracion(
      `Cada proveedor debe declarar al menos un modelo en ${ruta}`,
    )
  }

  return valor.map((modelo, indice) => validarModelo(modelo, indice, ruta))
}

function validarProveedor(
  valor: unknown,
  id: string,
  ruta: string,
): ConfiguracionProveedor {
  if (!esObjeto(valor)) {
    throw new ErrorConfiguracion(
      `El proveedor '${id}' debe ser un objeto en ${ruta}`,
    )
  }
  if (typeof valor.tipo !== 'string' || !valor.tipo) {
    throw new ErrorConfiguracion(
      `El proveedor '${id}' no declara un 'tipo' en ${ruta}`,
    )
  }
  if (typeof valor.baseUrl !== 'string' || !valor.baseUrl) {
    throw new ErrorConfiguracion(
      `El proveedor '${id}' no declara una 'baseUrl' en ${ruta}`,
    )
  }
  if (
    valor.variableApiKey !== undefined &&
    typeof valor.variableApiKey !== 'string'
  ) {
    throw new ErrorConfiguracion(
      `El proveedor '${id}' declara 'variableApiKey' inválido en ${ruta}`,
    )
  }
  if (valor.apiKey !== undefined && typeof valor.apiKey !== 'string') {
    throw new ErrorConfiguracion(
      `El proveedor '${id}' declara 'apiKey' inválido en ${ruta}`,
    )
  }

  return {
    tipo: valor.tipo,
    baseUrl: valor.baseUrl,
    ...(valor.variableApiKey !== undefined
      ? { variableApiKey: valor.variableApiKey }
      : {}),
    ...(valor.apiKey !== undefined ? { apiKey: valor.apiKey } : {}),
    ...(valor.cabecerasExtra !== undefined
      ? { cabecerasExtra: validarCabeceras(valor.cabecerasExtra, ruta) }
      : {}),
    modelos: validarModelos(valor.modelos, ruta),
  }
}

function validarConfig(datos: unknown, ruta: string): ConfiguracionHarness {
  if (!esObjeto(datos)) {
    throw new ErrorConfiguracion(`La configuración debe ser un objeto: ${ruta}`)
  }
  if (!esObjeto(datos.proveedores)) {
    throw new ErrorConfiguracion(
      `La configuración no declara 'proveedores': ${ruta}`,
    )
  }

  const proveedores: Record<string, ConfiguracionProveedor> = {}
  for (const [id, proveedor] of Object.entries(datos.proveedores)) {
    proveedores[id] = validarProveedor(proveedor, id, ruta)
  }

  return {
    proveedores,
    ...(typeof datos.proveedorPorDefecto === 'string'
      ? { proveedorPorDefecto: datos.proveedorPorDefecto }
      : {}),
    ...(typeof datos.modeloPorDefecto === 'string'
      ? { modeloPorDefecto: datos.modeloPorDefecto }
      : {}),
    ...(datos.sesiones !== undefined
      ? { sesiones: validarSesiones(datos.sesiones, ruta) }
      : {}),
  }
}

function validarSesiones(valor: unknown, ruta: string): ConfiguracionSesiones {
  if (!esObjeto(valor)) {
    throw new ErrorConfiguracion(`'sesiones' debe ser un objeto en ${ruta}`)
  }
  if (valor.guardar !== undefined && typeof valor.guardar !== 'boolean') {
    throw new ErrorConfiguracion(
      `'sesiones.guardar' debe ser booleano en ${ruta}`,
    )
  }
  if (
    valor.maximo !== undefined &&
    (typeof valor.maximo !== 'number' ||
      !Number.isInteger(valor.maximo) ||
      valor.maximo <= 0)
  ) {
    throw new ErrorConfiguracion(
      `'sesiones.maximo' debe ser un entero positivo en ${ruta}`,
    )
  }
  return {
    ...(valor.guardar !== undefined ? { guardar: valor.guardar } : {}),
    ...(valor.maximo !== undefined ? { maximo: valor.maximo } : {}),
  }
}

/**
 * Carga el config global y el del proyecto. El del proyecto pisa al global.
 * Un proveedor declarado en el proyecto reemplaza por completo al del global.
 */
export function cargarConfig(
  opciones: OpcionesCargarConfig = {},
): ConfiguracionHarness {
  const directorioProyecto = opciones.directorioProyecto ?? process.cwd()
  const entorno = opciones.entorno ?? process.env
  const rutaGlobal =
    opciones.directorioGlobal ?? rutaConfigGlobal(process.platform, entorno)
  const rutaProyecto = rutaConfigProyecto(directorioProyecto)

  const global = leerConfig(rutaGlobal)
  const proyecto = leerConfig(rutaProyecto)

  if (!global && !proyecto) {
    throw new ErrorConfiguracion(
      `No hay configuración del harness. Creá ${rutaProyecto} a partir de .harness/config.example.json o definí ${rutaGlobal}.`,
    )
  }

  return {
    proveedores: {
      ...(global?.proveedores ?? {}),
      ...(proyecto?.proveedores ?? {}),
    },
    ...((proyecto?.proveedorPorDefecto ?? global?.proveedorPorDefecto)
      ? {
          proveedorPorDefecto:
            proyecto?.proveedorPorDefecto ?? global?.proveedorPorDefecto,
        }
      : {}),
    ...((proyecto?.modeloPorDefecto ?? global?.modeloPorDefecto)
      ? {
          modeloPorDefecto:
            proyecto?.modeloPorDefecto ?? global?.modeloPorDefecto,
        }
      : {}),
    ...(proyecto?.sesiones || global?.sesiones
      ? { sesiones: { ...global?.sesiones, ...proyecto?.sesiones } }
      : {}),
  }
}

export function listarModelos(config: ConfiguracionHarness): string[] {
  const modelos: string[] = []
  for (const [proveedorId, proveedor] of Object.entries(config.proveedores)) {
    for (const modelo of proveedor.modelos) {
      modelos.push(`${proveedorId}/${modelo.id}`)
    }
  }
  return modelos
}

/**
 * Acepta un id con prefijo de proveedor (proveedor/modelo) o un id de modelo suelto.
 * El proveedor se separa por la primera barra para no romper ids como openai/gpt-4o.
 */
export function dividirIdModelo(
  id: string,
  proveedores: Record<string, unknown>,
): { proveedorId?: string | undefined; modeloId: string } {
  const indice = id.indexOf('/')
  if (indice > 0) {
    const posibleProveedor = id.slice(0, indice)
    if (Object.hasOwn(proveedores, posibleProveedor)) {
      return {
        proveedorId: posibleProveedor,
        modeloId: id.slice(indice + 1),
      }
    }
  }
  return { modeloId: id }
}

export function resolverModeloConfig(
  config: ConfiguracionHarness,
  proveedorId?: string | undefined,
  modeloId?: string | undefined,
): ModeloResuelto {
  const idsProveedores = Object.keys(config.proveedores)
  if (idsProveedores.length === 0) {
    throw new ErrorConfiguracion('La configuración no declara proveedores.')
  }

  const idProveedor =
    proveedorId ?? config.proveedorPorDefecto ?? idsProveedores[0]
  if (!idProveedor) {
    throw new ErrorConfiguracion('No se pudo determinar el proveedor activo.')
  }

  const proveedor = config.proveedores[idProveedor]
  if (!proveedor) {
    throw new ErrorConfiguracion(
      `El proveedor '${idProveedor}' no está configurado.`,
    )
  }

  let idModelo = modeloId ?? config.modeloPorDefecto
  if (idModelo) {
    const dividido = dividirIdModelo(idModelo, config.proveedores)
    if (dividido.proveedorId && dividido.proveedorId !== idProveedor) {
      throw new ErrorConfiguracion(
        `El modelo '${idModelo}' pertenece a otro proveedor.`,
      )
    }
    idModelo = dividido.modeloId
  } else {
    idModelo = proveedor.modelos[0]?.id
  }

  const modelo = proveedor.modelos.find((m) => m.id === idModelo)
  if (!modelo) {
    throw new ErrorConfiguracion(
      `El modelo '${idModelo ?? MODELO_POR_DEFECTO}' no está configurado para el proveedor '${idProveedor}'.`,
    )
  }

  return { proveedorId: idProveedor, proveedor, modelo }
}

/**
 * Resuelve la credencial sin exponerla. Un `variableApiKey` declarado exige la
 * variable; un `apiKey` literal se admite solo en el config local ignorado.
 */
export function credencialDeProveedor(
  proveedor: ConfiguracionProveedor,
  entorno: NodeJS.ProcessEnv = process.env,
): string {
  if (proveedor.variableApiKey) {
    const valor = entorno[proveedor.variableApiKey]
    if (!valor || valor.trim().length === 0) {
      throw new ErrorConfiguracion(
        `Falta la credencial requerida en la variable de entorno: ${proveedor.variableApiKey}`,
      )
    }
    return valor.trim()
  }
  return proveedor.apiKey?.trim() ?? ''
}

/** Junta las credenciales conocidas para que ningún error las devuelva al modelo. */
export function credencialesDeConfig(
  config: ConfiguracionHarness,
  entorno: NodeJS.ProcessEnv = process.env,
): string[] {
  const credenciales = new Set<string>()
  for (const proveedor of Object.values(config.proveedores)) {
    if (proveedor.apiKey) credenciales.add(proveedor.apiKey)
    if (proveedor.variableApiKey) {
      const valor = entorno[proveedor.variableApiKey]
      if (valor) credenciales.add(valor.trim())
    }
  }
  return [...credenciales].filter((c) => c.length >= 4)
}
