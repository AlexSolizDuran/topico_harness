import { describe, expect, it } from 'vitest'
import type { DefinicionAgente } from '../../src/agents/definiciones.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import type { Proveedor } from '../../src/provider/types.js'
import {
  GestorTareasBackground,
  MAXIMO_CONTINUACIONES_BACKGROUND,
} from '../../src/subagents/background.js'
import { crearHerramientaDelegacion } from '../../src/subagents/herramienta.js'
import {
  crearHerramientaCancelarTarea,
  crearHerramientaEstadoTareas,
} from '../../src/subagents/herramientas-background.js'

const EXPLORE: DefinicionAgente = {
  nombre: 'explore',
  descripcion: 'explora',
  modo: 'subagente',
  herramientas: ['read', 'glob', 'grep'],
}

function crearHerramienta(
  gestor: GestorTareasBackground,
  proveedor: Proveedor = new ProveedorSimulado({
    respuestas: [{ fragmentosTexto: ['resultado del subagente'] }],
  }),
) {
  return crearHerramientaDelegacion({
    obtenerAgentes: () => [EXPLORE],
    obtenerAgenteActivo: () => 'build',
    obtenerCatalogo: () => new RegistroHerramientas(),
    obtenerProveedorPadre: () => proveedor,
    gestorTareas: gestor,
  })
}

function crearProveedorConEspera(): {
  proveedor: Proveedor
  liberar: () => void
} {
  let liberar = (): void => {}
  const espera = new Promise<void>((resolve) => {
    liberar = resolve
  })
  const proveedor: Proveedor = {
    nombre: 'mock',
    modelo: 'modelo',
    async *enviar() {
      await espera
      yield { tipo: 'texto', delta: 'resultado del subagente' }
      yield { tipo: 'fin', razon: 'completado' }
    },
  }
  return { proveedor, liberar }
}

function crearSesion(
  gestorTareas: GestorTareasBackground | undefined,
  respuestas: number,
): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado({
      respuestas: Array.from({ length: respuestas }, (_, i) => ({
        fragmentosTexto: [`respuesta ${i + 1}`],
      })),
    }),
    registro: new RegistroHerramientas(),
    ventanaContexto: 40_000,
    ...(gestorTareas ? { gestorTareas } : {}),
  })
}

const senal = new AbortController().signal

describe('subagents Specification Tests — background', () => {
  // -------------------------------------------------------------------------
  // Requirement: Una tarea se puede lanzar en background
  // -------------------------------------------------------------------------
  describe('Requirement: Una tarea se puede lanzar en background', () => {
    it('Lanzar una tarea en background', async () => {
      // WHEN el padre pide una tarea con background
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      const { proveedor, liberar } = crearProveedorConEspera()
      const herramienta = crearHerramienta(gestor, proveedor)

      const salida = await herramienta.ejecutar(
        { agent: 'explore', prompt: 'investigá', background: true },
        senal,
      )

      // THEN la herramienta devuelve un identificador y el turno del padre sigue sin esperar
      expect(salida).toContain('t1')
      expect(gestor.obtener('t1')?.estado).toBe('en_curso')

      liberar()
      await gestor.esperarTodas()
      expect(gestor.obtener('t1')?.estado).toBe('completada')
    })

    it('Una tarea sin background espera', async () => {
      // WHEN el padre pide una tarea sin background
      const gestor = new GestorTareasBackground()
      const herramienta = crearHerramienta(gestor)

      const salida = await herramienta.ejecutar(
        { agent: 'explore', prompt: 'investigá' },
        senal,
      )

      // THEN la herramienta devuelve el resultado del subagente como hasta ahora
      expect(salida).toContain('resultado del subagente')
      expect(gestor.listar()).toHaveLength(0)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La cantidad de tareas en background está acotada
  // -------------------------------------------------------------------------
  describe('Requirement: La cantidad de tareas en background está acotada', () => {
    it('Se rechaza la tarea que excede el tope', async () => {
      // WHEN ya hay el máximo de tareas en background y el padre pide otra
      const gestor = new GestorTareasBackground({ maximo: 1 })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'primera',
        ejecutar: () => new Promise(() => {}),
      })
      const herramienta = crearHerramienta(gestor)

      const salida = await herramienta.ejecutar(
        { agent: 'explore', prompt: 'segunda', background: true },
        senal,
      )

      // THEN el sistema no la inicia y devuelve un mensaje de error
      expect(salida.startsWith('ERROR:')).toBe(true)
      expect(gestor.listar()).toHaveLength(1)
      gestor.cancelarTodas()
    })

    it('Una tarea terminada libera un lugar', async () => {
      // WHEN una tarea en background termina y había alcanzado el tope
      const gestor = new GestorTareasBackground({ maximo: 1 })
      const primera = gestor.iniciar({
        agente: 'explore',
        pedido: 'primera',
        ejecutar: async () => 'uno',
      })
      await gestor.esperarTodas()

      // THEN el padre puede iniciar otra tarea
      const segunda = gestor.iniciar({
        agente: 'explore',
        pedido: 'segunda',
        ejecutar: async () => 'dos',
      })
      await gestor.esperarTodas()

      expect(primera.id).not.toBe(segunda.id)
      expect(gestor.listar()).toHaveLength(2)
      expect(gestor.obtener(segunda.id)?.estado).toBe('completada')
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: El estado de las tareas se puede consultar
  // -------------------------------------------------------------------------
  describe('Requirement: El estado de las tareas se puede consultar', () => {
    it('Consultar una tarea terminada', async () => {
      // WHEN el padre consulta una tarea terminada
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'investigá',
        ejecutar: async () => 'hallazgo',
      })
      await gestor.esperarTodas()
      const herramienta = crearHerramientaEstadoTareas(gestor)

      const salida = await herramienta.ejecutar({ id: 't1' }, senal)

      // THEN recibe su estado y su resultado
      expect(salida).toContain('completada')
      expect(salida).toContain('hallazgo')
    })

    it('Consultar las tareas en curso', async () => {
      // WHEN el padre consulta sin identificador
      const gestor = new GestorTareasBackground()
      gestor.iniciar({
        agente: 'explore',
        pedido: 'una',
        ejecutar: () => new Promise(() => {}),
      })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'dos',
        ejecutar: () => new Promise(() => {}),
      })
      const herramienta = crearHerramientaEstadoTareas(gestor)

      const salida = await herramienta.ejecutar({}, senal)

      // THEN recibe la lista de tareas con su estado
      expect(salida).toContain('en_curso')
      expect(gestor.listar()).toHaveLength(2)
      gestor.cancelarTodas()
    })

    it('Consultar una tarea inexistente', async () => {
      // WHEN el padre consulta un identificador que no existe
      const gestor = new GestorTareasBackground()
      const herramienta = crearHerramientaEstadoTareas(gestor)

      const salida = await herramienta.ejecutar({ id: 'no-existe' }, senal)

      // THEN recibe un mensaje de error como texto
      expect(salida.startsWith('ERROR:')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Una tarea en background se puede cancelar
  // -------------------------------------------------------------------------
  describe('Requirement: Una tarea en background se puede cancelar', () => {
    it('Cancelar una tarea en curso', async () => {
      // WHEN el padre cancela una tarea que sigue en curso
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'larga',
        ejecutar: (senalTarea) =>
          new Promise((_resolve, reject) => {
            senalTarea.addEventListener('abort', () => reject(new Error('x')))
          }),
      })
      const herramienta = crearHerramientaCancelarTarea(gestor)

      const salida = await herramienta.ejecutar({ id: 't1' }, senal)
      await gestor.esperarTodas()

      // THEN la tarea queda cancelada y el resto sigue igual
      expect(salida).toContain('cancelada')
      expect(gestor.obtener('t1')?.estado).toBe('cancelada')
    })

    it('Cancelar una tarea inexistente', async () => {
      // WHEN el padre cancela un identificador que no existe
      const gestor = new GestorTareasBackground()
      const herramienta = crearHerramientaCancelarTarea(gestor)

      const salida = await herramienta.ejecutar({ id: 'no-existe' }, senal)

      // THEN recibe un mensaje de error como texto
      expect(salida.startsWith('ERROR:')).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Al cerrar el turno el padre espera e inyecta los resultados
  // -------------------------------------------------------------------------
  describe('Requirement: Al cerrar el turno el padre espera e inyecta los resultados', () => {
    it('El padre continúa con el resultado', async () => {
      // WHEN el turno del padre termina y quedan tareas en background
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      let liberar = (): void => {}
      const espera = new Promise<void>((resolve) => {
        liberar = resolve
      })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'investigá',
        ejecutar: async () => {
          await espera
          return 'hallazgo importante'
        },
      })
      const proveedor = new ProveedorSimulado({
        respuestas: [
          { fragmentosTexto: ['respuesta 1'] },
          { fragmentosTexto: ['respuesta 2'] },
        ],
      })
      const sesion = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
        ventanaContexto: 40_000,
        gestorTareas: gestor,
      })

      const promesa = sesion.enviarMensaje('hola')
      liberar()
      await promesa

      // THEN el sistema espera, inyecta los resultados y ejecuta un turno de continuación
      expect(proveedor.peticionesRecibidas).toHaveLength(2)
      const segunda = proveedor.peticionesRecibidas[1]?.mensajes ?? []
      expect(
        segunda.some((mensaje) =>
          mensaje.contenido?.includes('[Resultados de tareas en background]'),
        ),
      ).toBe(true)
      expect(
        segunda.some((mensaje) =>
          mensaje.contenido?.includes('hallazgo importante'),
        ),
      ).toBe(true)
    })

    it('Sin tareas pendientes no hay continuación', async () => {
      // WHEN el turno del padre termina sin tareas en background
      const gestor = new GestorTareasBackground()
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['ok'] }],
      })
      const sesion = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
        ventanaContexto: 40_000,
        gestorTareas: gestor,
      })

      await sesion.enviarMensaje('hola')

      // THEN el sistema no ejecuta un turno adicional
      expect(proveedor.peticionesRecibidas).toHaveLength(1)
    })

    it('Un resultado se inyecta una sola vez', async () => {
      // WHEN el padre recibe el resultado de una tarea y sigue trabajando
      const gestor = new GestorTareasBackground()
      gestor.iniciar({
        agente: 'explore',
        pedido: 'x',
        ejecutar: async () => 'resultado',
      })
      await gestor.esperarTodas()

      const primero = gestor.consumirResultados()
      const segundo = gestor.consumirResultados()

      // THEN ese resultado no se vuelve a inyectar en continuaciones posteriores
      expect(primero).toContain('resultado')
      expect(segundo).toBeUndefined()
    })

    it('El límite de continuaciones detiene la cadena', async () => {
      // WHEN las continuaciones alcanzan el límite configurado
      const gestor = {
        establecerObservador: () => {},
        hayPendientes: () => true,
        tareasEnCurso: () => [{ estado: 'en_curso' }],
        esperarTodas: async () => [],
        consumirResultados: () => 'resultado inyectado',
        cancelarTodas: () => {},
      } as unknown as GestorTareasBackground
      const proveedor = new ProveedorSimulado({
        respuestas: Array.from(
          { length: MAXIMO_CONTINUACIONES_BACKGROUND + 2 },
          (_, i) => ({ fragmentosTexto: [`respuesta ${i + 1}`] }),
        ),
      })
      const sesion = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
        ventanaContexto: 40_000,
        gestorTareas: gestor,
      })

      await sesion.enviarMensaje('hola')

      // THEN el sistema deja de continuar y muestra un aviso
      expect(proveedor.peticionesRecibidas).toHaveLength(
        MAXIMO_CONTINUACIONES_BACKGROUND + 1,
      )
      expect(
        sesion
          .obtenerEstado()
          .historial.some(
            (item) => item.tipo === 'aviso' && item.texto.includes('límite de'),
          ),
      ).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La cancelación del padre alcanza a sus tareas en background
  // -------------------------------------------------------------------------
  describe('Requirement: La cancelación del padre alcanza a sus tareas en background', () => {
    it('Cancelar el padre cancela las tareas', async () => {
      // WHEN el usuario cancela el turno del padre con tareas en background
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'larga',
        ejecutar: (senalTarea) =>
          new Promise((_resolve, reject) => {
            senalTarea.addEventListener('abort', () => reject(new Error('x')))
          }),
      })
      const sesion = crearSesion(gestor, 1)

      const promesa = sesion.enviarMensaje('hola')
      await new Promise((resolve) => setTimeout(resolve, 0))
      sesion.cancelar()
      await promesa
      await new Promise((resolve) => setTimeout(resolve, 0))

      // THEN esas tareas quedan canceladas
      expect(gestor.obtener('t1')?.estado).toBe('cancelada')
    })

    it('Una tarea cancelada no reporta éxito', async () => {
      // WHEN se inyectan resultados y una tarea fue cancelada
      const gestor = new GestorTareasBackground({ generarId: () => 't1' })
      gestor.iniciar({
        agente: 'explore',
        pedido: 'larga',
        ejecutar: (senalTarea) =>
          new Promise((_resolve, reject) => {
            senalTarea.addEventListener('abort', () => reject(new Error('x')))
          }),
      })
      gestor.cancelar('t1')
      await gestor.esperarTodas()

      const salida = gestor.consumirResultados() ?? ''

      // THEN su resultado se informa como cancelado, no como completado
      expect(salida).toContain('cancelada')
      expect(salida).not.toContain('completada')
    })
  })
})
