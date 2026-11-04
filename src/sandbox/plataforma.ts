import type { ConfiguracionSandbox, InformacionAislamiento } from './types.js'

export type TipoMecanismoAislamiento = 'bwrap' | 'sandbox-exec' | 'ninguno'

export function determinarMecanismoAislamiento(
  config?: ConfiguracionSandbox | undefined,
  plataforma: NodeJS.Platform = process.platform,
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

  // 3. Plataformas soportadas por el SO
  if (plataforma === 'linux') {
    return {
      aislado: true,
      mecanismo: 'bwrap',
    }
  }

  if (plataforma === 'darwin') {
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
