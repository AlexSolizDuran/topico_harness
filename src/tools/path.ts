import { isAbsolute, normalize, resolve } from 'node:path'

export class ErrorRutaInvalida extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ErrorRutaInvalida'
  }
}

/**
 * Resuelve una ruta asegurando que apunte al interior del proyecto.
 * Acepta tanto separadores Unix (/) como Windows (\).
 */
export function resolverRutaSegura(
  rutaEntrada: string,
  directorioProyecto: string = process.cwd(),
): string {
  // 1. Normalizar separadores
  const rutaNormalizada = rutaEntrada.replace(/\\/g, '/')
  const baseNormalizada = resolve(directorioProyecto)

  // 2. Si es absoluta, verificar que pertenezca al directorio del proyecto
  const rutaAbsoluta = isAbsolute(rutaNormalizada)
    ? resolve(rutaNormalizada)
    : resolve(baseNormalizada, rutaNormalizada)

  // 3. Comprobar que no salga del árbol del proyecto
  const rutaConSeparador = normalize(rutaAbsoluta)
  const baseConSeparador = normalize(baseNormalizada)

  if (
    !rutaConSeparador.startsWith(baseConSeparador) ||
    (rutaConSeparador !== baseConSeparador &&
      !rutaConSeparador.startsWith(`${baseConSeparador}\\`) &&
      !rutaConSeparador.startsWith(`${baseConSeparador}/`))
  ) {
    throw new ErrorRutaInvalida(
      `Ruta fuera del proyecto no permitida: '${rutaEntrada}'`,
    )
  }

  return rutaConSeparador
}
