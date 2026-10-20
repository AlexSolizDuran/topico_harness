import { type Instance, render } from 'ink'
import type React from 'react'
import { AppInteractiva } from './app-interactiva.js'
import type { SesionInteractiva } from './runner.js'

export interface OpcionesRenderInteractivo {
  pedidoInicial?: string | undefined
  directorio?: string | undefined
}

/**
 * Monta la TUI con Ctrl+C desactivado: la cancelación la decide la sesión, no
 * el proceso. Al salir, Ink restaura la terminal.
 */
export function renderizarInteractivo(
  sesion: SesionInteractiva,
  opciones: OpcionesRenderInteractivo = {},
): Instance {
  const elemento: React.ReactElement = (
    <AppInteractiva
      sesion={sesion}
      pedidoInicial={opciones.pedidoInicial}
      directorio={opciones.directorio}
    />
  )
  return render(elemento, { exitOnCtrlC: false })
}
