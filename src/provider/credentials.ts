import { ErrorCredencial } from './types.js'

/**
 * Encabezados sensibles que jamás deben persistirse en registros ni exponerse en errores.
 */
const ENCABEZADOS_SENSIBLES = new Set([
  'authorization',
  'x-api-key',
  'api-key',
  'proxy-authorization',
])

/**
 * Obtiene la credencial desde el entorno validando su presencia antes del envío.
 */
export function obtenerCredencial(
  nombreVariable: string,
  entorno: NodeJS.ProcessEnv = process.env,
): string {
  const valor = entorno[nombreVariable]
  if (!valor || valor.trim().length === 0) {
    throw new ErrorCredencial(
      `Falta la credencial requerida en la variable de entorno: ${nombreVariable}`,
    )
  }
  return valor.trim()
}

/**
 * Oculta cualquier valor confidencial reemplazándolo por [REDACTADO].
 */
export function sanitizarTexto(texto: string, credenciales: string[]): string {
  let resultado = texto
  for (const credencial of credenciales) {
    if (credencial.length >= 4) {
      resultado = resultado.split(credencial).join('[REDACTADO]')
    }
  }
  return resultado
}

/**
 * Sanitiza encabezados y registros para evitar fugas de secretos en telemetría o logs.
 */
export function sanitizarRegistro<T extends Record<string, unknown>>(
  datos: T,
  credenciales: string[] = [],
): T {
  const copia = JSON.parse(JSON.stringify(datos)) as Record<string, unknown>

  function limpiarObjeto(obj: Record<string, unknown>): void {
    for (const clave of Object.keys(obj)) {
      const valor = obj[clave]
      const claveNormalizada = clave.toLowerCase()

      if (ENCABEZADOS_SENSIBLES.has(claveNormalizada)) {
        obj[clave] = '[REDACTADO]'
      } else if (typeof valor === 'string') {
        obj[clave] = sanitizarTexto(valor, credenciales)
      } else if (valor && typeof valor === 'object' && !Array.isArray(valor)) {
        limpiarObjeto(valor as Record<string, unknown>)
      }
    }
  }

  limpiarObjeto(copia)
  return copia as T
}
