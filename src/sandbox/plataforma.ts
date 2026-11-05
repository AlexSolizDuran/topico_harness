import { spawnSync } from 'node:child_process'
import type { ConfiguracionSandbox, InformacionAislamiento } from './types.js'

export type TipoMecanismoAislamiento = 'bwrap' | 'sandbox-exec' | 'ninguno'

/**
 * Comprueba que el binario del mecanismo exista. No alcanza con mirar la
 * plataforma: un Linux sin bubblewrap instalado no puede presentarse como aislado.
 */
export function mecanismoDisponible(nombre: string): boolean {
  try {
    const resultado = spawnSync(nombre, ['--version'], {
      stdio: 'ignore',
      timeout: 2000,
    })
    return resultado.error === undefined
  } catch {
    return false
  }
}

export function determinarMecanismoAislamiento(
  config?: ConfiguracionSandbox | undefined,
  plataforma: NodeJS.Platform = process.platform,
  disponible: (mecanismo: string) => boolean = mecanismoDisponible,
): InformacionAislamiento {
  // 1. Deshabilitado explícitamente por configuración
  if (config?.habilitado === false) {
    return {
      aislado: false,
      motivoDegradacion:
        'Aislamiento deshabilitado explícitamente en la configuración.',
    }
  }

  // 2. Mecanismo forzado para pruebas o entornos específicos
  if (config?.mecanismoForzado) {
    if (config.mecanismoForzado === 'ninguno') {
      return {
        aislado: false,
        motivoDegradacion: 'Sin aislamiento disponible para esta plataforma.',
      }
    }
    return {
      aislado: true,
      mecanismo: config.mecanismoForzado,
    }
  }

  // 3. Plataformas soportadas por el SO, con verificación del binario
  if (plataforma === 'linux') {
    if (!disponible('bwrap')) {
      return {
        aislado: false,
        motivoDegradacion:
          "La plataforma Linux no tiene 'bwrap' instalado. Ejecutando sin aislamiento.",
      }
    }
    return {
      aislado: true,
      mecanismo: 'bwrap',
    }
  }

  if (plataforma === 'darwin') {
    if (!disponible('sandbox-exec')) {
      return {
        aislado: false,
        motivoDegradacion:
          "La plataforma macOS no tiene 'sandbox-exec' disponible. Ejecutando sin aislamiento.",
      }
    }
    return {
      aislado: true,
      mecanismo: 'sandbox-exec',
    }
  }

  // 4. Windows y otras plataformas sin aislamiento nativo documentado
  return {
    aislado: false,
    motivoDegradacion: `La plataforma '${plataforma}' no ofrece un mecanismo de aislamiento del sistema operativo compatible. Ejecutando sin aislamiento.`,
  }
}
