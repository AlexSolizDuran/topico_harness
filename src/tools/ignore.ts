const DIRECTORIOS_IGNORADOS = new Set([
  'node_modules',
  '.git',
  '.vitest',
  'coverage',
  'dist',
  '.harness',
])

function partesRuta(ruta: string): string[] {
  return ruta
    .replace(/\\/g, '/')
    .split('/')
    .filter((parte) => parte.length > 0)
}

function esArchivoDeEntorno(nombre: string): boolean {
  if (nombre.endsWith('.env.example')) return false
  return nombre === '.env' || nombre.startsWith('.env.')
}

/** Directorios y archivos que ninguna búsqueda debe recorrer. */
export function debeIgnorarRuta(rutaRelativa: string): boolean {
  const partes = partesRuta(rutaRelativa)
  if (partes.some((parte) => DIRECTORIOS_IGNORADOS.has(parte))) return true
  const nombre = partes[partes.length - 1] ?? ''
  return esArchivoDeEntorno(nombre)
}

/**
 * Rutas que las herramientas no deben leer ni escribir: el config local del
 * harness y los archivos de entorno pueden contener credenciales.
 */
export function esRutaSensible(rutaRelativa: string): boolean {
  const partes = partesRuta(rutaRelativa)
  if (partes.includes('.harness')) return true
  const nombre = partes[partes.length - 1] ?? ''
  return esArchivoDeEntorno(nombre)
}
