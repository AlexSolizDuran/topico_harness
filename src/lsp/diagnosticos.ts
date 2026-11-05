import type { RegistroHerramientas } from '../core/registry.js'
import { resolverRuta } from '../tools/path.js'
import type { GestorLsp } from './gestor.js'

const HERRAMIENTAS_QUE_EDITAN = ['edit', 'write', 'apply_patch'] as const

function rutasAfectadas(
  nombre: string,
  argumentos: Record<string, unknown>,
): string[] {
  if (nombre === 'apply_patch') {
    const parche = String(argumentos.patch ?? '')
    return Array.from(
      parche.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm),
      (coincidencia) => coincidencia[1]?.trim() ?? '',
    ).filter((ruta) => ruta.length > 0)
  }
  const ruta = argumentos.ruta
  return typeof ruta === 'string' && ruta.trim().length > 0 ? [ruta.trim()] : []
}

/**
 * Envuelve las herramientas que editan archivos para devolver los diagnósticos
 * del archivo afectado. Un fallo del servidor de lenguaje se agrega como texto:
 * nunca revierte la edición ni interrumpe el turno.
 */
export function decorarHerramientasConDiagnosticos(
  registro: RegistroHerramientas,
  gestor: GestorLsp,
  directorioProyecto: string,
): void {
  for (const nombre of HERRAMIENTAS_QUE_EDITAN) {
    const original = registro.obtener(nombre)
    if (!original) continue

    const ejecutarOriginal = original.ejecutar.bind(original)
    registro.registrar({
      ...original,
      ejecutar: async (argumentos, senal) => {
        const resultado = await ejecutarOriginal(argumentos, senal)
        if (/^ERROR/i.test(resultado)) return resultado

        const diagnosticos: string[] = []
        for (const ruta of rutasAfectadas(nombre, argumentos)) {
          const rutaAbsoluta = resolverRuta(ruta, directorioProyecto)
          const texto = await gestor.obtenerDiagnosticosDeArchivo(rutaAbsoluta)
          if (texto.length > 0) diagnosticos.push(texto)
        }
        if (diagnosticos.length === 0) return resultado
        return `${resultado}\n\nDiagnósticos:\n${diagnosticos.join('\n\n')}`
      },
    })
  }
}
