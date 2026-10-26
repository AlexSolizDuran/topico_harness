export interface Argumentos {
  ayuda: boolean
  directorio?: string | undefined
  modelo?: string | undefined
  agente?: string | undefined
  continuar: boolean
  sesion?: string | undefined
  sinSesion: boolean
  ramaDe?: string | undefined
  desde?: number | undefined
  pedido: string
}

export const AYUDA = `Uso: harness [opciones] [pedido...]

Opciones:
  --dir <ruta>       Directorio del proyecto (por defecto, el actual)
  --modelo <id>      Modelo a usar (proveedor/modelo)
  --agente <nombre>  Agente primario inicial (por defecto, build)
  --continuar        Reanuda la última sesión guardada del proyecto
  --sesion <id>      Reanuda la sesión indicada
  --rama-de <id>     Crea una rama desde la sesión indicada (requiere --desde)
  --desde <n>        Turno de la sesión de origen donde corta la rama
  --sin-sesion       No guarda ni reanuda sesiones
  -h, --help         Muestra esta ayuda

Sin pedido y con terminal interactiva abre la TUI. Sin pedido y sin terminal
lee la entrada estándar.`

function leerValor(
  args: string[],
  indice: number,
  arg: string,
): { valor: string | undefined; siguiente: number } {
  const igual = arg.indexOf('=')
  if (igual !== -1) {
    return { valor: arg.slice(igual + 1), siguiente: indice }
  }
  return { valor: args[indice + 1], siguiente: indice + 1 }
}

export function parsearArgumentos(args: string[]): Argumentos {
  const resultado: Argumentos = {
    ayuda: false,
    continuar: false,
    sinSesion: false,
    pedido: '',
  }
  const resto: string[] = []
  let despuesDeSeparador = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] ?? ''

    if (despuesDeSeparador) {
      resto.push(arg)
      continue
    }

    if (arg === '--') {
      despuesDeSeparador = true
      continue
    }

    if (arg === '-h' || arg === '--help') {
      resultado.ayuda = true
      continue
    }

    if (arg === '--dir' || arg.startsWith('--dir=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.directorio = valor
      i = siguiente
      continue
    }

    if (arg === '--modelo' || arg.startsWith('--modelo=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.modelo = valor
      i = siguiente
      continue
    }

    if (arg === '--agente' || arg.startsWith('--agente=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.agente = valor
      i = siguiente
      continue
    }

    if (arg === '--continuar') {
      resultado.continuar = true
      continue
    }

    if (arg === '--sesion' || arg.startsWith('--sesion=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.sesion = valor
      i = siguiente
      continue
    }

    if (arg === '--rama-de' || arg.startsWith('--rama-de=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.ramaDe = valor
      i = siguiente
      continue
    }

    if (arg === '--desde' || arg.startsWith('--desde=')) {
      const { valor, siguiente } = leerValor(args, i, arg)
      resultado.desde = valor === undefined ? Number.NaN : Number(valor)
      i = siguiente
      continue
    }

    if (arg === '--sin-sesion') {
      resultado.sinSesion = true
      continue
    }

    resto.push(arg)
  }

  resultado.pedido = resto.join(' ').trim()
  return resultado
}
