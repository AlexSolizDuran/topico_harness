import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cargarAgentes,
  crearAgentesPorDefecto,
  type DefinicionAgente,
  validarDefinicionAgente,
} from '../../src/agents/index.js'
import { ejecutarTurno, RegistroHerramientas } from '../../src/core/index.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import {
  type PeticionProveedor,
  ProveedorSimulado,
} from '../../src/provider/index.js'
import {
  crearHerramientaDelegacion,
  ejecutarTurnoSubagente,
} from '../../src/subagents/index.js'
import { crearCatalogoPorDefecto } from '../../src/tools/catalog.js'
import type { EstadoTurno, EventoTurno } from '../../src/types.js'

async function consumirTurno(
  gen: AsyncGenerator<EventoTurno, EstadoTurno, unknown>,
): Promise<{ eventos: EventoTurno[]; estado: EstadoTurno }> {
  const eventos: EventoTurno[] = []
  let iter = await gen.next()
  while (!iter.done) {
    eventos.push(iter.value)
    iter = await gen.next()
  }
  return { eventos, estado: iter.value }
}

describe('subagents Specification Tests', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-subagents-test-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --------------------------------------------------------------------------
  // Requirement: El harness delega una investigación a un subagente
  // --------------------------------------------------------------------------
  describe('Requirement: El harness delega una investigación a un subagente', () => {
    it('El modelo delega una búsqueda a un subagente', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const agentes = crearAgentesPorDefecto(catalogo.listarNombres())
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Hallazgo del subagente'] }],
      })

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerAgenteActivo: () => 'build',
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
      })

      const res = await toolTask.ejecutar({
        agent: 'explore',
        prompt: 'buscá dónde se define SesionInteractiva',
      })

      expect(res).toBe('Hallazgo del subagente')
    })

    it('El modelo elige el subagente por su descripción', () => {
      const agentes: DefinicionAgente[] = [
        {
          nombre: 'explore',
          descripcion: 'Explora estructura de archivos',
          modo: 'subagente',
          herramientas: ['read', 'glob'],
        },
        {
          nombre: 'buscador',
          descripcion: 'Busca patrones exactos en código',
          modo: 'subagente',
          herramientas: ['grep'],
        },
      ]

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerAgenteActivo: () => 'build',
        obtenerCatalogo: () => new RegistroHerramientas(),
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      expect(toolTask.descripcion).toContain(
        'explore: Explora estructura de archivos',
      )
      expect(toolTask.descripcion).toContain(
        'buscador: Busca patrones exactos en código',
      )
    })

    it('Un subagente inexistente devuelve un error como texto', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const agentes = crearAgentesPorDefecto(catalogo.listarNombres())
      const proveedorHijo = new ProveedorSimulado()

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerAgenteActivo: () => 'build',
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
      })

      const res = await toolTask.ejecutar({
        agent: 'no_existe',
        prompt: 'investigá',
      })

      expect(res).toContain('ERROR')
      expect(res).toContain('no_existe')
      expect(res).toContain('explore')
      expect(proveedorHijo.peticionesRecibidas).toHaveLength(0)
    })

    it('El agente activo no se ofrece como subagente de sí mismo', async () => {
      const agentes: DefinicionAgente[] = [
        {
          nombre: 'polivalente',
          descripcion: 'Modo ambos',
          modo: 'ambos',
          herramientas: ['read'],
        },
        {
          nombre: 'explore',
          descripcion: 'Subagente puro',
          modo: 'subagente',
          herramientas: ['read'],
        },
      ]

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerAgenteActivo: () => 'polivalente',
        obtenerCatalogo: () => new RegistroHerramientas(),
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      expect(toolTask.descripcion).not.toContain('polivalente: Modo ambos')
      expect(toolTask.descripcion).toContain('explore: Subagente puro')

      const res = await toolTask.ejecutar({
        agent: 'polivalente',
        prompt: 'intento recursivo',
      })
      expect(res).toContain('ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El subagente tiene contexto aislado
  // --------------------------------------------------------------------------
  describe('Requirement: El subagente tiene contexto aislado', () => {
    it('El hijo no hereda el historial del padre', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['respuesta aislada'] }],
      })
      const subagente: DefinicionAgente = {
        nombre: 'explore',
        descripcion: 'Explorador',
        modo: 'subagente',
        herramientas: ['read'],
        prompt: 'Prompt exclusivo del hijo',
      }

      const res = await ejecutarTurnoSubagente({
        subagente,
        pedido: 'pedido puntual',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      expect(res.salida).toBe('respuesta aislada')
      const peticionHijo = proveedorHijo.peticionesRecibidas[0]
      expect(peticionHijo?.mensajes).toEqual([
        { rol: 'user', contenido: 'pedido puntual' },
      ])
      expect(peticionHijo?.sistema).toContain('Prompt exclusivo del hijo')
    })

    it('El padre no ve los pasos intermedios', async () => {
      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object', properties: {} },
        ejecutar: async () => 'contenido interno del archivo',
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [{ id: 'h1', nombre: 'read', argumentos: {} }],
          },
          { fragmentosTexto: ['resumen limpio'] },
        ],
      })

      const agentes: DefinicionAgente[] = [
        {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: ['read'],
        },
      ]

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
      })
      catalogo.registrar(toolTask)

      const proveedorPadre = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'p1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'leé el archivo' },
              },
            ],
          },
          { fragmentosTexto: ['El padre terminó'] },
        ],
      })

      const { estado } = await consumirTurno(
        ejecutarTurno({
          proveedor: proveedorPadre,
          registro: catalogo,
          mensajes: [{ rol: 'user', contenido: 'iniciá' }],
        }),
      )

      const mensajesToolPadre = estado.mensajes.filter((m) => m.rol === 'tool')
      expect(mensajesToolPadre).toHaveLength(1)
      expect(mensajesToolPadre[0]?.resultado).toBe('resumen limpio')
      expect(
        estado.mensajes.some(
          (m) => m.resultado === 'contenido interno del archivo',
        ),
      ).toBe(false)
    })

    it('El contexto del padre crece solo con la respuesta', async () => {
      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object', properties: {} },
        ejecutar: async () => 'intermedio largo '.repeat(50),
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [{ id: 'h1', nombre: 'read', argumentos: {} }],
          },
          { fragmentosTexto: ['una línea corta'] },
        ],
      })

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => [
          {
            nombre: 'explore',
            descripcion: 'Explorador',
            modo: 'subagente',
            herramientas: ['read'],
          },
        ],
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
      })
      catalogo.registrar(toolTask)

      const proveedorPadre = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'p1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'investigá' },
              },
            ],
          },
          { fragmentosTexto: ['listo'] },
        ],
      })

      const { estado } = await consumirTurno(
        ejecutarTurno({
          proveedor: proveedorPadre,
          registro: catalogo,
          mensajes: [{ rol: 'user', contenido: 'hola' }],
        }),
      )

      expect(estado.mensajes).toHaveLength(4)
      expect(estado.mensajes[2]).toEqual({
        rol: 'tool',
        idLlamada: 'p1',
        resultado: 'una línea corta',
      })
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El resultado del subagente es un texto único
  // --------------------------------------------------------------------------
  describe('Requirement: El resultado del subagente es un texto único', () => {
    it('El padre recibe una respuesta, no un stream', async () => {
      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object', properties: {} },
        ejecutar: async () => 'ok',
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            fragmentosTexto: ['Pensando paso 1...'],
            llamadasHerramienta: [{ id: 'h1', nombre: 'read', argumentos: {} }],
          },
          { fragmentosTexto: ['Conclusión ', 'final'] },
        ],
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: ['read'],
        },
        pedido: 'investigá',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      expect(res.salida).toBe('Conclusión final')
      expect(res.salida).not.toContain('Pensando paso 1')
    })

    it('Un resultado largo se trunca', async () => {
      const catalogo = new RegistroHerramientas()
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['X'.repeat(200)] }],
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: [],
        },
        pedido: 'investigá',
        catalogo,
        proveedorPadre: proveedorHijo,
        maximoContenido: 50,
      })

      expect(res.salida).toContain(
        '[Contenido truncado. Se mostraron 50 de 200 caracteres]',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un subagente no puede lanzar subagentes
  // --------------------------------------------------------------------------
  describe('Requirement: Un subagente no puede lanzar subagentes', () => {
    it('El subagente no tiene la herramienta de delegación', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => crearAgentesPorDefecto(catalogo.listarNombres()),
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })
      catalogo.registrar(toolTask)

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['listo'] }],
      })

      await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'ambos',
          descripcion: 'Ambos',
          modo: 'ambos',
          herramientas: ['read', 'task'],
        },
        pedido: 'probá',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      const herramientasHijo =
        proveedorHijo.peticionesRecibidas[0]?.herramientas?.map(
          (h) => h.nombre,
        ) ?? []
      expect(herramientasHijo).toEqual(['read'])
      expect(herramientasHijo).not.toContain('task')
    })

    it('Una delegación anidada se rechaza como texto', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'anidada',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'nivel 2' },
              },
            ],
          },
          { fragmentosTexto: ['No pude delegar, respondo yo'] },
        ],
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: ['read'],
        },
        pedido: 'nivel 1',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      expect(res.salida).toBe('No pude delegar, respondo yo')
      const segundaPeticion = proveedorHijo.peticionesRecibidas[1]
      const resultadoTool = segundaPeticion?.mensajes.find(
        (m) => m.rol === 'tool',
      )
      expect(resultadoTool?.resultado).toContain('ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un subagente no modifica el proyecto
  // --------------------------------------------------------------------------
  describe('Requirement: Un subagente no modifica el proyecto', () => {
    it('Un agente lanzado no recibe escritura ni ejecución', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['solo leí'] }],
      })

      await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'hibrido',
          descripcion: 'Declara todo pero corre como hijo',
          modo: 'ambos',
          herramientas: ['read', 'glob', 'grep', 'write', 'edit', 'shell'],
        },
        pedido: 'investigá',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      const herramientasHijo =
        proveedorHijo.peticionesRecibidas[0]?.herramientas?.map(
          (h) => h.nombre,
        ) ?? []
      expect(herramientasHijo).toEqual(['read', 'glob', 'grep'])
      expect(herramientasHijo).not.toContain('write')
      expect(herramientasHijo).not.toContain('edit')
      expect(herramientasHijo).not.toContain('shell')
    })

    it('Una definición de subagente con escritura falla al arrancar', () => {
      expect(() =>
        validarDefinicionAgente(
          {
            nombre: 'sub-escritor',
            descripcion: 'Intenta declarar write',
            modo: 'subagente',
            herramientas: ['read', 'write'],
          },
          { herramientasDisponibles: ['read', 'write', 'shell'] },
        ),
      ).toThrow(/sub-escritor.*write/)
    })

    it('Una llamada del hijo a escribir se rechaza como texto', async () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'w1',
                nombre: 'write',
                argumentos: { ruta: 'x.txt', contenido: 'mal' },
              },
            ],
          },
          { fragmentosTexto: ['Rechazado, solo informo'] },
        ],
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: ['read'],
        },
        pedido: 'intentá escribir',
        catalogo,
        proveedorPadre: proveedorHijo,
      })

      expect(res.salida).toBe('Rechazado, solo informo')
      const mensajeTool = proveedorHijo.peticionesRecibidas[1]?.mensajes.find(
        (m) => m.rol === 'tool',
      )
      expect(mensajeTool?.resultado).toContain('ERROR')
      expect(mensajeTool?.resultado).toContain('write')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La cancelación del padre alcanza al subagente
  // --------------------------------------------------------------------------
  describe('Requirement: La cancelación del padre alcanza al subagente', () => {
    it('Cancelar el padre cancela al hijo', async () => {
      const controllerPadre = new AbortController()
      let hijoAbortado = false

      class ProveedorHijoLento extends ProveedorSimulado {
        override async *enviar(peticion: PeticionProveedor) {
          controllerPadre.abort()
          hijoAbortado = Boolean(peticion.senalCancelacion?.aborted)
          yield { tipo: 'texto' as const, delta: 'parcial que no debe llegar' }
        }
      }

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: [],
        },
        pedido: 'tarea lenta',
        catalogo: new RegistroHerramientas(),
        proveedorPadre: new ProveedorHijoLento(),
        senalCancelacionPadre: controllerPadre.signal,
      })

      expect(hijoAbortado).toBe(true)
      expect(res.canceladoPorPadre).toBe(true)
      expect(res.salida).toBe('')
    })

    it('Cancelar al hijo no cancela al padre', async () => {
      const controllerPadre = new AbortController()
      const controllerHijo = new AbortController()
      controllerHijo.abort()

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: [],
        },
        pedido: 'cancelar solo hijo',
        catalogo: new RegistroHerramientas(),
        proveedorPadre: new ProveedorSimulado(),
        senalCancelacionPadre: controllerPadre.signal,
        senalCancelacionHijo: controllerHijo.signal,
      })

      expect(controllerPadre.signal.aborted).toBe(false)
      expect(res.canceladoPorPadre).toBe(false)
      expect(res.salida).toContain('ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El subagente tiene presupuesto y límite de pasos propios
  // --------------------------------------------------------------------------
  describe('Requirement: El subagente tiene presupuesto y límite de pasos propios', () => {
    it('El límite de pasos del hijo no consume el del padre', async () => {
      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object', properties: {} },
        ejecutar: async () => 'dato',
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: Array(5).fill({
          llamadasHerramienta: [{ id: 'h', nombre: 'read', argumentos: {} }],
        }),
      })

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => [
          {
            nombre: 'explore',
            descripcion: 'Explorador',
            modo: 'subagente',
            herramientas: ['read'],
          },
        ],
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
        obtenerLimitePasos: () => 2,
      })
      catalogo.registrar(toolTask)

      const proveedorPadre = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'p1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'investigá' },
              },
            ],
          },
          { fragmentosTexto: ['El padre sigue y termina en paso 2'] },
        ],
      })

      const { estado } = await consumirTurno(
        ejecutarTurno({
          proveedor: proveedorPadre,
          registro: catalogo,
          mensajes: [{ rol: 'user', contenido: 'adelante' }],
          limitePasos: 3,
        }),
      )

      expect(estado.tipo).toBe('completado')
      expect(estado.pasosEjecutados).toBe(2)
    })

    it('Un hijo que agota su límite devuelve el motivo', async () => {
      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object', properties: {} },
        ejecutar: async () => 'dato',
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: Array(5).fill({
          llamadasHerramienta: [{ id: 'h', nombre: 'read', argumentos: {} }],
        }),
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador',
          modo: 'subagente',
          herramientas: ['read'],
        },
        pedido: 'bucle en hijo',
        catalogo,
        proveedorPadre: proveedorHijo,
        limitePasos: 2,
      })

      expect(res.esError).toBe(true)
      expect(res.salida).toContain('límite')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El subagente usa el modelo de su definición
  // --------------------------------------------------------------------------
  describe('Requirement: El subagente usa el modelo de su definición', () => {
    it('El hijo usa el modelo declarado', async () => {
      const proveedorPadre = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'openai/gpt-4o',
      })
      const proveedorBarato = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'deepseek/deepseek-chat',
        respuestas: [{ fragmentosTexto: ['desde modelo barato'] }],
      })

      const res = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explorador barato',
          modo: 'subagente',
          herramientas: [],
          modelo: 'openrouter/deepseek/deepseek-chat',
        },
        pedido: 'buscá rápido',
        catalogo: new RegistroHerramientas(),
        proveedorPadre,
        resolverModelo: () => ({
          proveedor: proveedorBarato,
          ventanaContexto: 64000,
        }),
      })

      expect(res.salida).toBe('desde modelo barato')
      expect(proveedorBarato.peticionesRecibidas).toHaveLength(1)
      expect(proveedorPadre.peticionesRecibidas).toHaveLength(0)
    })

    it('El modelo del padre no cambia después del hijo', async () => {
      const proveedorPadre = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'openai/gpt-4o',
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 't1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'investigá' },
              },
            ],
          },
          { fragmentosTexto: ['padre sigue con gpt-4o'] },
        ],
      })
      const proveedorHijo = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'deepseek/deepseek-chat',
        respuestas: [{ fragmentosTexto: ['hijo terminó'] }],
      })

      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const agentes: DefinicionAgente[] = [
        {
          nombre: 'build',
          descripcion: 'Primario',
          modo: 'primario',
          herramientas: ['read', 'task'],
        },
        {
          nombre: 'explore',
          descripcion: 'Hijo',
          modo: 'subagente',
          herramientas: ['read'],
          modelo: 'openrouter/deepseek/deepseek-chat',
        },
      ]

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => agentes,
        obtenerAgenteActivo: () => 'build',
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorPadre,
        resolverModelo: () => ({ proveedor: proveedorHijo }),
      })
      catalogo.registrar(toolTask)

      const sesion = new SesionInteractiva({
        proveedor: proveedorPadre,
        registro: catalogo,
        agentes,
        modeloActivo: 'openrouter/openai/gpt-4o',
      })

      await sesion.enviarMensaje('delegá y seguí')

      expect(sesion.obtenerModeloActivo()).toBe('openrouter/openai/gpt-4o')
      expect(proveedorPadre.peticionesRecibidas).toHaveLength(2)
      expect(proveedorHijo.peticionesRecibidas).toHaveLength(1)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Sin configuración hay al menos un subagente de solo lectura
  // --------------------------------------------------------------------------
  describe('Requirement: Sin configuración hay al menos un subagente de solo lectura', () => {
    it('Sin archivo de agentes hay un subagente disponible', () => {
      const dirVacio = mkdtempSync(join(tempDir, 'sin-config-'))
      const cargados = cargarAgentes({
        directorioProyecto: dirVacio,
        herramientasDisponibles: ['read', 'glob', 'grep'],
      })

      const subagentes = cargados.agentes.filter(
        (a) => a.modo === 'subagente' || a.modo === 'ambos',
      )
      expect(subagentes.length).toBeGreaterThanOrEqual(1)
      expect(subagentes[0]?.nombre).toBe('explore')
    })

    it('El subagente por defecto pide solo el resultado', () => {
      const defaults = crearAgentesPorDefecto(['read', 'glob', 'grep'])
      const explore = defaults.find((a) => a.nombre === 'explore')

      expect(explore).toBeDefined()
      expect(explore?.prompt).toContain('solo el resultado')
    })
  })
})
