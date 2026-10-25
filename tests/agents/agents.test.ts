import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  cargarAgentes,
  crearAgentesPorDefecto,
  type DefinicionAgente,
  validarConjuntoAgentes,
  validarDefinicionAgente,
} from '../../src/agents/index.js'
import { construirHarness } from '../../src/app.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import {
  ErrorCambioAgente,
  SesionInteractiva,
} from '../../src/interface/runner.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { crearHerramientaDelegacion } from '../../src/subagents/herramienta.js'
import { crearCatalogoPorDefecto } from '../../src/tools/catalog.js'

describe('agents Specification Tests', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-agents-test-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --------------------------------------------------------------------------
  // Requirement: Cada agente se define como un dato declarativo
  // --------------------------------------------------------------------------
  describe('Requirement: Cada agente se define como un dato declarativo', () => {
    it('Agregar un agente no requiere tocar el bucle', async () => {
      const dir = mkdtempSync(join(tempDir, 'decl-'))
      mkdirSync(join(dir, '.harness'), { recursive: true })
      writeFileSync(
        join(dir, '.harness', 'agents.json'),
        JSON.stringify({
          agentes: [
            {
              nombre: 'auditor',
              descripcion: 'Audita archivos sin tocar nada',
              modo: 'primario',
              herramientas: ['read', 'grep'],
              prompt: 'Sos un auditor estricto.',
            },
          ],
        }),
        'utf-8',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Auditoría lista'] }],
      })
      const { sesion } = construirHarness({
        directorioProyecto: dir,
        proveedor,
      })

      expect(sesion.listarAgentes().map((a) => a.nombre)).toContain('auditor')
      sesion.cambiarAgente('auditor')
      await sesion.enviarMensaje('revisá el código')

      expect(proveedor.peticionesRecibidas).toHaveLength(1)
      const herramientasEnviadas =
        proveedor.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre) ??
        []
      expect(herramientasEnviadas).toEqual(['read', 'grep'])
    })

    it('El archivo de agentes se lee al arrancar', () => {
      const dir = mkdtempSync(join(tempDir, 'arranque-'))
      mkdirSync(join(dir, '.harness'), { recursive: true })
      writeFileSync(
        join(dir, '.harness', 'agents.json'),
        JSON.stringify({
          agentePorDefecto: 'revisor',
          agentes: [
            {
              nombre: 'revisor',
              descripcion: 'Revisa cambios',
              modo: 'primario',
              herramientas: ['read'],
            },
          ],
        }),
        'utf-8',
      )

      const { sesion, agentes } = construirHarness({
        directorioProyecto: dir,
        proveedor: new ProveedorSimulado(),
      })

      expect(agentes.map((a) => a.nombre)).toContain('revisor')
      expect(sesion.obtenerAgenteActivo()).toBe('revisor')
    })

    it('Un agente declara su modelo', async () => {
      const proveedorPrincipal = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'openai/gpt-4o',
        respuestas: [{ fragmentosTexto: ['principal'] }],
      })
      const proveedorRazonador = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'deepseek/deepseek-chat',
        respuestas: [{ fragmentosTexto: ['razonador'] }],
      })

      const agentes: DefinicionAgente[] = [
        {
          nombre: 'build',
          descripcion: 'Agente base',
          modo: 'primario',
          herramientas: ['read'],
        },
        {
          nombre: 'arquitecto',
          descripcion: 'Agente con modelo propio',
          modo: 'primario',
          herramientas: ['read'],
          modelo: 'openrouter/deepseek/deepseek-chat',
        },
      ]

      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: proveedorPrincipal,
        registro,
        agentes,
        modelosDisponibles: [
          'openrouter/openai/gpt-4o',
          'openrouter/deepseek/deepseek-chat',
        ],
        modeloActivo: 'openrouter/openai/gpt-4o',
        fabricaProveedor: () => ({ proveedor: proveedorRazonador }),
      })

      sesion.cambiarAgente('arquitecto')
      await sesion.enviarMensaje('diseñá el módulo')

      expect(proveedorRazonador.peticionesRecibidas).toHaveLength(1)
      expect(proveedorPrincipal.peticionesRecibidas).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El modo determina cómo se invoca un agente
  // --------------------------------------------------------------------------
  describe('Requirement: El modo determina cómo se invoca un agente', () => {
    const definiciones: DefinicionAgente[] = [
      {
        nombre: 'primario-1',
        descripcion: 'Primario',
        modo: 'primario',
        herramientas: ['read'],
      },
      {
        nombre: 'sub-1',
        descripcion: 'Subagente',
        modo: 'subagente',
        herramientas: ['read'],
      },
      {
        nombre: 'ambos-1',
        descripcion: 'Ambos modos',
        modo: 'ambos',
        herramientas: ['read'],
      },
    ]

    it('Un agente primario se ofrece en la sesión', () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro,
        agentes: definiciones,
      })

      expect(sesion.listarAgentes().map((a) => a.nombre)).toContain(
        'primario-1',
      )
    })

    it('Un subagente no se ofrece como agente principal', () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro,
        agentes: definiciones,
      })

      expect(sesion.listarAgentes().map((a) => a.nombre)).not.toContain('sub-1')
      expect(() => sesion.cambiarAgente('sub-1')).toThrow(ErrorCambioAgente)
    })

    it('Un agente de modo ambos se ofrece en la sesión', () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro,
        agentes: definiciones,
      })

      expect(sesion.listarAgentes().map((a) => a.nombre)).toContain('ambos-1')
      sesion.cambiarAgente('ambos-1')
      expect(sesion.obtenerAgenteActivo()).toBe('ambos-1')
    })

    it('Un agente primario no se lanza como subagente', async () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => definiciones,
        obtenerAgenteActivo: () => 'ambos-1',
        obtenerCatalogo: () => registro,
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      const respuesta = await toolTask.ejecutar({
        agent: 'primario-1',
        prompt: 'investigá esto',
      })

      expect(respuesta).toContain('ERROR')
      expect(respuesta).toContain('primario-1')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un agente solo recibe las herramientas que declara
  // --------------------------------------------------------------------------
  describe('Requirement: Un agente solo recibe las herramientas que declara', () => {
    it('La petición solo incluye las herramientas del agente', async () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['listo'] }],
      })
      const agentes = crearAgentesPorDefecto(registro.listarNombres())
      const sesion = new SesionInteractiva({
        proveedor,
        registro,
        agentes,
        agenteActivo: 'plan',
      })

      await sesion.enviarMensaje('analizá')

      const enviadas =
        proveedor.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre) ??
        []
      expect(enviadas).toEqual(['read', 'glob', 'grep'])
      expect(enviadas).not.toContain('write')
      expect(enviadas).not.toContain('edit')
      expect(enviadas).not.toContain('shell')
    })

    it('Una herramienta no declarada se rechaza aunque el modelo la pida', async () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'c1',
                nombre: 'write',
                argumentos: { ruta: 'peligro.txt', contenido: 'no' },
              },
            ],
          },
          { fragmentosTexto: ['entendido'] },
        ],
      })
      const agentes = crearAgentesPorDefecto(registro.listarNombres())
      const sesion = new SesionInteractiva({
        proveedor,
        registro,
        agentes,
        agenteActivo: 'plan',
      })

      await sesion.enviarMensaje('intentá escribir')

      const ultimoTurno = sesion.obtenerUltimoTurno()
      const mensajeTool = ultimoTurno?.mensajes.find((m) => m.rol === 'tool')
      expect(mensajeTool?.resultado).toContain('ERROR')
      expect(mensajeTool?.resultado).toContain('write')
    })

    it('El agente completo ve todas las herramientas disponibles', async () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['listo'] }],
      })
      const agentes = crearAgentesPorDefecto(registro.listarNombres())
      const sesion = new SesionInteractiva({
        proveedor,
        registro,
        agentes,
        agenteActivo: 'build',
      })

      await sesion.enviarMensaje('trabajá')

      const enviadas =
        proveedor.peticionesRecibidas[0]?.herramientas?.map((h) => h.nombre) ??
        []
      expect(enviadas).toEqual(registro.listarNombres())
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El agente activo se conserva y cambia de forma atómica
  // --------------------------------------------------------------------------
  describe('Requirement: El agente activo se conserva y cambia de forma atómica', () => {
    it('Cambiar de agente conserva el historial y el modelo', async () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const proveedor = new ProveedorSimulado({
        nombre: 'openrouter',
        modelo: 'openai/gpt-4o',
        respuestas: [
          { fragmentosTexto: ['respuesta 1'] },
          { fragmentosTexto: ['respuesta 2'] },
        ],
      })
      const sesion = new SesionInteractiva({
        proveedor,
        registro,
        agentes: crearAgentesPorDefecto(registro.listarNombres()),
        modeloActivo: 'openrouter/openai/gpt-4o',
      })

      await sesion.enviarMensaje('turno 1')
      const largoAntes = sesion.obtenerEstado().historial.length
      sesion.cambiarAgente('plan')

      expect(sesion.obtenerAgenteActivo()).toBe('plan')
      expect(sesion.obtenerModeloActivo()).toBe('openrouter/openai/gpt-4o')
      expect(sesion.obtenerEstado().historial.length).toBe(largoAntes)

      await sesion.enviarMensaje('turno 2')
      expect(proveedor.peticionesRecibidas[1]?.mensajes[0]?.contenido).toBe(
        'turno 1',
      )
    })

    it('No se cambia de agente durante un turno en curso', async () => {
      class ProveedorLento extends ProveedorSimulado {
        override async *enviar() {
          await new Promise((r) => setTimeout(r, 30))
          yield { tipo: 'texto' as const, delta: 'fin' }
        }
      }

      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorLento(),
        registro,
        agentes: crearAgentesPorDefecto(registro.listarNombres()),
      })

      const promesa = sesion.enviarMensaje('lento')
      expect(() => sesion.cambiarAgente('plan')).toThrow(ErrorCambioAgente)
      await promesa

      expect(sesion.obtenerAgenteActivo()).toBe('build')
    })

    it('La sesión arranca con el agente primario por defecto', () => {
      const registro = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro,
      })

      expect(sesion.obtenerAgenteActivo()).toBe('build')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Una definición inválida falla al arrancar con un mensaje explícito
  // --------------------------------------------------------------------------
  describe('Requirement: Una definición inválida falla al arrancar con un mensaje explícito', () => {
    it('Una herramienta inexistente falla al arrancar', () => {
      expect(() =>
        validarDefinicionAgente(
          {
            nombre: 'roto',
            descripcion: 'Declara herramienta fantasma',
            modo: 'primario',
            herramientas: ['read', 'herramienta_fantasma'],
          },
          { herramientasDisponibles: ['read', 'glob'] },
        ),
      ).toThrow(/roto.*herramienta_fantasma/)
    })

    it('Un modo desconocido falla al arrancar', () => {
      expect(() =>
        validarDefinicionAgente(
          {
            nombre: 'modo-invalido',
            descripcion: 'Modo raro',
            modo: 'fantasma',
            herramientas: ['read'],
          },
          { herramientasDisponibles: ['read'] },
        ),
      ).toThrow(/modo-invalido.*fantasma/)
    })

    it('Un nombre repetido falla al arrancar', () => {
      expect(() =>
        validarConjuntoAgentes(
          [
            {
              nombre: 'duplicado',
              descripcion: 'Uno',
              modo: 'primario',
              herramientas: ['read'],
            },
            {
              nombre: 'duplicado',
              descripcion: 'Dos',
              modo: 'primario',
              herramientas: ['read'],
            },
          ],
          { herramientasDisponibles: ['read'] },
        ),
      ).toThrow(/duplicado/)
    })

    it('Sin ningún agente primario falla al arrancar', () => {
      expect(() =>
        validarConjuntoAgentes(
          [
            {
              nombre: 'solo-sub',
              descripcion: 'Solo subagente',
              modo: 'subagente',
              herramientas: ['read'],
            },
          ],
          { herramientasDisponibles: ['read'] },
        ),
      ).toThrow(/primario/)
    })

    it('Un modelo inexistente falla al arrancar', () => {
      expect(() =>
        validarDefinicionAgente(
          {
            nombre: 'con-modelo-falso',
            descripcion: 'Modelo no configurado',
            modo: 'primario',
            herramientas: ['read'],
            modelo: 'openrouter/modelo-inexistente',
          },
          {
            herramientasDisponibles: ['read'],
            modelosDisponibles: ['openrouter/openai/gpt-4o'],
          },
        ),
      ).toThrow(/con-modelo-falso.*openrouter\/modelo-inexistente/)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Sin configuración el sistema ofrece un agente completo y uno de solo lectura
  // --------------------------------------------------------------------------
  describe('Requirement: Sin configuración el sistema ofrece un agente completo y uno de solo lectura', () => {
    it('Sin archivo de agentes hay uno completo y uno de lectura', () => {
      const dirSinArchivo = mkdtempSync(join(tempDir, 'sin-archivo-'))
      const disponibles = ['read', 'glob', 'grep', 'write', 'edit', 'shell']
      const cargados = cargarAgentes({
        directorioProyecto: dirSinArchivo,
        herramientasDisponibles: disponibles,
      })

      const nombres = cargados.agentes.map((a) => a.nombre)
      expect(nombres).toContain('build')
      expect(nombres).toContain('plan')
      const build = cargados.agentes.find((a) => a.nombre === 'build')
      expect(build?.herramientas).toEqual(disponibles)
    })

    it('El agente de solo lectura no incluye escritura ni ejecución', () => {
      const disponibles = ['read', 'glob', 'grep', 'write', 'edit', 'shell']
      const defaults = crearAgentesPorDefecto(disponibles)
      const plan = defaults.find((a) => a.nombre === 'plan')

      expect(plan).toBeDefined()
      expect(plan?.herramientas).toEqual(['read', 'glob', 'grep'])
      expect(plan?.herramientas).not.toContain('write')
      expect(plan?.herramientas).not.toContain('edit')
      expect(plan?.herramientas).not.toContain('shell')
    })

    it('filtrar RegistroHerramientas no muta el original', () => {
      const original = new RegistroHerramientas()
      original.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: { type: 'object' },
        ejecutar: async () => '',
      })
      original.registrar({
        nombre: 'write',
        descripcion: 'escribe',
        esquema: { type: 'object' },
        ejecutar: async () => '',
      })

      const filtrado = original.filtrar(['read'])
      expect(filtrado.listarNombres()).toEqual(['read'])
      expect(original.listarNombres()).toEqual(['read', 'write'])
    })
  })
})
