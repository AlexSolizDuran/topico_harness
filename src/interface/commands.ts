export interface ComandoUi {
  id: string
  etiqueta: string
  descripcion: string
  alias?: string[] | undefined
}

export const COMANDOS: readonly ComandoUi[] = [
  {
    id: 'modelo',
    etiqueta: '/modelo',
    descripcion: 'Elegir el modelo activo o cambiarlo',
    alias: ['model'],
  },
  {
    id: 'contexto',
    etiqueta: '/contexto',
    descripcion: 'Ver ventana, presupuesto y uso actual',
    alias: ['context'],
  },
  {
    id: 'ayuda',
    etiqueta: '/ayuda',
    descripcion: 'Ver atajos y comandos disponibles',
    alias: ['help'],
  },
  {
    id: 'salir',
    etiqueta: '/salir',
    descripcion: 'Cerrar la sesión',
    alias: ['quit', 'exit'],
  },
]

export function filtrarComandos(filtro: string): readonly ComandoUi[] {
  const limpio = filtro.trim().replace(/^\//, '').toLowerCase()
  if (!limpio) return COMANDOS

  return COMANDOS.filter(
    (comando) =>
      comando.id.startsWith(limpio) ||
      comando.etiqueta.slice(1).startsWith(limpio) ||
      comando.alias?.some((alias) => alias.startsWith(limpio)),
  )
}
