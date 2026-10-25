import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { renderToString } from 'ink'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { crearAgentesPorDefecto } from '../../src/agents/index.js'
import { PresupuestoContexto } from '../../src/context/budget.js'
import { medirContexto } from '../../src/context/metrics.js'
import { RegistroHerramientas } from '../../src/core/index.js'
import {
  aplicarEventoTurno,
  aplicarTecla,
  BarraEstado,
  COMANDOS,
  crearEstadoInicial,
  ENTRADA_VACIA,
  PanelAprobacion,
  RenderizadorLineaALinea,
  SelectorAgente,
  SesionInteractiva,
  TarjetaDelegacion,
  TarjetaHerramientaEnCurso,
} from '../../src/interface/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { crearHerramientaDelegacion } from '../../src/subagents/index.js'

const HERRAMIENTAS_BASE = ['read', 'write', 'edit', 'glob', 'grep', 'shell']

describe('interface Agent, Subagent, Permission and Batch Tests', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-interface-agent-test-'))
  })

  afterAll(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // Ignorar errores de limpieza en Windows
    }
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz muestra el estado de la sesión
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra el estado de la sesión', () => {
    it('Sesión lista', () => {
      // WHEN no hay un turno en curso
      const presupuesto = new PresupuestoContexto({ ventanaContexto: 4000 })
      const contexto = medirContexto(presupuesto, [])
      const estado = crearEstadoInicial(
        '',
        'openrouter/openai/gpt-4o',
        contexto,
        'build',
      )

      const salida = renderToString(<BarraEstado estado={estado} />)

      // THEN la barra muestra el modelo activo, el agente activo, que la sesión está lista y el uso de contexto
      expect(salida).toContain('openrouter/openai/gpt-4o')
      expect(salida).toContain('[build]')
      expect(salida).toContain('listo')
      expect(salida).toContain('0/3.2k')
    })

    it('Sesión trabajando', () => {
      // WHEN hay un turno en curso
      const presupuesto = new PresupuestoContexto({ ventanaContexto: 4000 })
      const contexto = medirContexto(presupuesto, [])
      const estado = {
        ...crearEstadoInicial('', 'openrouter/openai/gpt-4o', contexto, 'plan'),
        turnoEnCurso: true,
      }

      const salida = renderToString(<BarraEstado estado={estado} />)

      // THEN la barra muestra que la sesión está trabajando
      expect(salida).toContain('trabajando')
      expect(salida).toContain('[plan]')
    })

    it('La barra muestra el agente activo', () => {
      // WHEN se cambia de agente
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        agentes: crearAgentesPorDefecto(HERRAMIENTAS_BASE),
        agenteActivo: 'build',
      })

      sesion.cambiarAgente('plan')
      const salida = renderToString(
        <BarraEstado estado={sesion.obtenerEstado()} />,
      )

      // THEN la barra refleja el nombre del nuevo agente activo
      expect(salida).toContain('[plan]')
      expect(salida).not.toContain('[build]')
    })

    it('La barra muestra la espera de aprobación', () => {
      // WHEN hay una solicitud de aprobación pendiente de respuesta
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'espera_aprobacion',
        solicitud: {
          id: 'call_1',
          herramienta: 'write',
          accion: 'edit',
          recurso: 'src/a.ts',
          patronSugerido: 'src/**',
        },
      })

      const salida = renderToString(<BarraEstado estado={estado} />)

      // THEN la barra indica que la sesión espera una decisión antes de continuar
      expect(salida).toContain('esperando aprobación')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz permite cambiar el agente activo
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz permite cambiar el agente activo', () => {
    it('Cambiar de agente con el atajo', () => {
      // WHEN no hay un turno en curso y la persona pulsa el atajo de cambio de agente
      const accion = aplicarTecla(ENTRADA_VACIA, '', { tab: true })

      // THEN el agente activo avanza al siguiente de la lista (solo primarios: build <-> plan) y la barra de estado lo refleja
      expect(accion.tipo).toBe('cambiar_agente')

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        agentes: crearAgentesPorDefecto(HERRAMIENTAS_BASE),
        agenteActivo: 'build',
      })
      expect(sesion.obtenerAgenteActivo()).toBe('build')
      sesion.ciclarAgente()
      expect(sesion.obtenerAgenteActivo()).toBe('plan')
      sesion.ciclarAgente()
      expect(sesion.obtenerAgenteActivo()).toBe('build')
    })

    it('Elegir un agente desde la lista', () => {
      // WHEN la persona abre el comando de agentes y selecciona uno
      expect(COMANDOS.some((c) => c.id === 'agente')).toBe(true)

      const agentes = crearAgentesPorDefecto(HERRAMIENTAS_BASE)
      const primarios = agentes.filter((a) => a.modo === 'primario')
      const salidaSelector = renderToString(
        <SelectorAgente agentes={primarios} seleccionado={1} activo="build" />,
      )
      expect(salidaSelector).toContain('● build')
      expect(salidaSelector).toContain('› ○ plan')

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        agentes,
        agenteActivo: 'build',
      })
      sesion.cambiarAgente('plan')

      // THEN ese agente queda activo para el turno siguiente
      expect(sesion.obtenerAgenteActivo()).toBe('plan')
    })

    it('El agente activo se conserva entre turnos', async () => {
      // WHEN un turno termina con un agente elegido
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado({
          respuestas: [
            { fragmentosTexto: ['Turno 1 en plan'] },
            { fragmentosTexto: ['Turno 2 en plan'] },
          ],
        }),
        registro: new RegistroHerramientas(),
        agentes: crearAgentesPorDefecto(HERRAMIENTAS_BASE),
        agenteActivo: 'build',
      })

      sesion.cambiarAgente('plan')
      await sesion.enviarMensaje('analizá esto')
      await sesion.enviarMensaje('seguí analizando')

      // THEN el turno siguiente arranca con ese mismo agente sin volver al agente por defecto
      expect(sesion.obtenerAgenteActivo()).toBe('plan')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz distingue una delegación a un subagente
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz distingue una delegación a un subagente', () => {
    it('La delegación se distingue de una herramienta común', () => {
      // WHEN el padre inicia una delegación a un subagente
      const salida = renderToString(
        <TarjetaHerramientaEnCurso
          herramienta={{
            id: 'call_sub',
            nombre: 'task',
            argumentos: { agent: 'explore', prompt: 'Buscá las rutas' },
            iniciadaEn: Date.now(),
            completada: false,
          }}
        />,
      )

      // THEN la interfaz muestra qué agente fue invocado y cuál fue el pedido delegado
      expect(salida).toContain('subagente: explore')
      expect(salida).toContain('pedido: Buscá las rutas')
      expect(salida).toContain('investigando')
    })

    it('La delegación terminada muestra el resumen', () => {
      // WHEN el subagente termina y devuelve su resultado
      const salida = renderToString(
        <TarjetaDelegacion
          subagente="explore"
          pedido="Buscá las rutas"
          resultado="Se encontraron 3 rutas en src/tools/path.ts"
          esError={false}
          truncado={false}
        />,
      )

      // THEN la interfaz muestra la delegación como completada junto con el resumen devuelto
      expect(salida).toContain('subagente: explore')
      expect(salida).toContain('Se encontraron 3 rutas en src/tools/path.ts')
    })

    it('El texto del hijo no aparece en el stream del padre', async () => {
      // WHEN el subagente produce fragmentos de texto durante su turno interno
      const registro = new RegistroHerramientas()
      const agentes = crearAgentesPorDefecto(HERRAMIENTAS_BASE)
      const proveedorHijo = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['Resumen limpio del hijo'] }],
      })

      registro.registrar(
        crearHerramientaDelegacion({
          obtenerAgentes: () => agentes,
          obtenerCatalogo: () => registro,
          obtenerProveedorPadre: () => proveedorHijo,
        }),
      )

      const proveedorPadre = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'sub1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'Revisá' },
              },
            ],
          },
          { fragmentosTexto: ['Texto final del padre'] },
        ],
      })

      const sesion = new SesionInteractiva({
        proveedor: proveedorPadre,
        registro,
        agentes,
        agenteActivo: 'build',
      })

      await sesion.enviarMensaje('delegá la búsqueda')

      // THEN la interfaz no mezcla esos fragmentos con el texto en vivo del padre
      const textosAsistente = sesion
        .obtenerEstado()
        .historial.filter((e) => e.tipo === 'asistente')
        .map((e) => (e.tipo === 'asistente' ? e.texto : ''))
      expect(textosAsistente).toEqual(['Texto final del padre'])
    })

    it('La distinción se mantiene sin terminal', () => {
      // WHEN la sesión corre en modo línea a línea sin terminal interactiva
      const lineas: string[] = []
      const render = new RenderizadorLineaALinea((l) => lineas.push(l))

      render.mostrarDelegacion(
        'explore',
        'Revisar arquitectura',
        'Hallazgos del explorador',
        false,
        false,
      )

      // THEN la delegación también identifica al agente invocado y su resultado
      expect(lineas[0]).toContain('[Subagente: explore]')
      expect(lineas[0]).toContain('Revisar arquitectura')
      expect(lineas[0]).toContain('Hallazgos del explorador')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz pide aprobación antes de ejecutar una herramienta
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz pide aprobación antes de ejecutar una herramienta', () => {
    it('Se pide aprobación con la acción y el recurso', () => {
      // WHEN una llamada queda en espera de aprobación en una terminal interactiva
      const salida = renderToString(
        <PanelAprobacion
          solicitud={{
            id: 'call_1',
            herramienta: 'write',
            accion: 'edit',
            recurso: 'src/nuevo.ts',
            patronSugerido: 'src/**',
          }}
        />,
      )

      // THEN la interfaz muestra la acción y el recurso y espera una de las tres decisiones
      expect(salida).toContain('edit')
      expect(salida).toContain('src/nuevo.ts')
      expect(salida).toContain('Aprobar una vez')
      expect(salida).toContain('Aprobar siempre')
      expect(salida).toContain('Denegar')
    })

    it('Aprobar una vez ejecuta solo esa solicitud', async () => {
      // WHEN la persona aprueba por única vez una solicitud pendiente
      const registro = new RegistroHerramientas()
      const toolWrite = {
        nombre: 'write',
        descripcion: 'escribe',
        esquema: { required: ['ruta'] },
        accionPermiso: 'edit' as const,
        obtenerRecurso: (args: Record<string, unknown>) =>
          String(args.ruta ?? '*'),
        ejecutar: async () => 'escrito',
      }
      registro.registrar(toolWrite)

      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro,
        directorioProyecto: tempDir,
        esInteractivo: true,
        reglasPermiso: [{ accion: 'edit', recurso: '*', efecto: 'consultar' }],
      })

      const gestor = sesion.obtenerGestorPermisos()
      const promesa1 = gestor.solicitarAprobacion({
        id: 'c1',
        herramienta: 'write',
        accion: 'edit',
        recurso: 'src/uno.ts',
        patronSugerido: 'src/**',
      })

      sesion.responderAprobacion('una_vez')
      const decision1 = await promesa1

      // THEN esa llamada se ejecuta y una solicitud posterior equivalente vuelve a pedir aprobación
      expect(decision1).toBe('una_vez')
      expect(gestor.evaluar(toolWrite, { ruta: 'src/uno.ts' }).efecto).toBe(
        'consultar',
      )
    })

    it('Aprobar siempre deja de preguntar para ese patrón', async () => {
      // WHEN la persona aprueba siempre una solicitud pendiente
      const dirAprobacion = mkdtempSync(join(tmpdir(), 'harness-aprob-'))
      try {
        const registro = new RegistroHerramientas()
        const toolWrite = {
          nombre: 'write',
          descripcion: 'escribe',
          esquema: { required: ['ruta'] },
          accionPermiso: 'edit' as const,
          obtenerRecurso: (args: Record<string, unknown>) =>
            String(args.ruta ?? '*'),
          ejecutar: async () => 'escrito',
        }
        registro.registrar(toolWrite)

        const sesion = new SesionInteractiva({
          proveedor: new ProveedorSimulado(),
          registro,
          directorioProyecto: dirAprobacion,
          esInteractivo: true,
          reglasPermiso: [
            { accion: 'edit', recurso: '*', efecto: 'consultar' },
          ],
        })

        const gestor = sesion.obtenerGestorPermisos()
        const promesa = gestor.solicitarAprobacion({
          id: 'c1',
          herramienta: 'write',
          accion: 'edit',
          recurso: 'src/modulo.ts',
          patronSugerido: 'src/**',
        })

        sesion.responderAprobacion('siempre')
        const decision = await promesa

        // THEN esa llamada se ejecuta y las siguientes que coincidan con el patrón no vuelven a preguntar
        expect(decision).toBe('siempre')
        expect(gestor.evaluar(toolWrite, { ruta: 'src/otro.ts' }).efecto).toBe(
          'permitir',
        )
      } finally {
        rmSync(dirAprobacion, { recursive: true, force: true })
      }
    })

    it('Denegar devuelve el rechazo y no ejecuta', async () => {
      // WHEN la persona rechaza una solicitud pendiente
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        directorioProyecto: tempDir,
        esInteractivo: true,
        reglasPermiso: [{ accion: 'edit', recurso: '*', efecto: 'consultar' }],
      })

      const gestor = sesion.obtenerGestorPermisos()
      const promesa = gestor.solicitarAprobacion({
        id: 'c1',
        herramienta: 'write',
        accion: 'edit',
        recurso: 'src/peligro.ts',
        patronSugerido: 'src/**',
      })

      sesion.responderAprobacion('denegar')
      const decision = await promesa

      // THEN la herramienta no se ejecuta y el turno continúa con el rechazo como resultado
      expect(decision).toBe('denegar')
      expect(sesion.obtenerEstado().aprobacionPendiente).toBeUndefined()
    })

    it('Sin terminal interactiva no se aprueba nada', async () => {
      // WHEN una llamada requiere aprobación en modo sin terminal interactiva
      const sesion = new SesionInteractiva({
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        directorioProyecto: tempDir,
        esInteractivo: false,
        reglasPermiso: [{ accion: 'edit', recurso: '*', efecto: 'consultar' }],
      })

      const gestor = sesion.obtenerGestorPermisos()
      const decision = await gestor.solicitarAprobacion({
        id: 'c1',
        herramienta: 'write',
        accion: 'edit',
        recurso: 'src/archivo.ts',
        patronSugerido: 'src/**',
      })

      // THEN la interfaz no espera entrada y devuelve el rechazo
      expect(decision).toBe('denegar')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La interfaz muestra las herramientas de una tanda
  // --------------------------------------------------------------------------
  describe('Requirement: La interfaz muestra las herramientas de una tanda', () => {
    it('Una tanda muestra todas sus tarjetas al empezar', () => {
      // WHEN comienza una tanda con varias llamadas en paralelo
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_inicio',
        id: 'call_1',
        nombre: 'read',
        argumentos: { ruta: 'a.ts' },
      })
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_inicio',
        id: 'call_2',
        nombre: 'read',
        argumentos: { ruta: 'b.ts' },
      })
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_inicio',
        id: 'call_3',
        nombre: 'glob',
        argumentos: { patron: '**/*.ts' },
      })

      // THEN la interfaz muestra una tarjeta en curso por cada llamada de la tanda
      expect(estado.herramientasEnCurso).toHaveLength(3)
      expect(estado.herramientasEnCurso.map((h) => h.id)).toEqual([
        'call_1',
        'call_2',
        'call_3',
      ])
    })

    it('Las tarjetas se completan a medida que terminan', () => {
      // WHEN una de las llamadas de la tanda termina mientras otra sigue en curso
      let estado = crearEstadoInicial()
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_inicio',
        id: 'call_1',
        nombre: 'read',
        argumentos: { ruta: 'lento.ts' },
      })
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_inicio',
        id: 'call_2',
        nombre: 'read',
        argumentos: { ruta: 'rapido.ts' },
      })

      // Termina call_2 primero mientras call_1 sigue en curso
      estado = aplicarEventoTurno(estado, {
        tipo: 'herramienta_fin',
        id: 'call_2',
        nombre: 'read',
        resultado: 'contenido_rapido',
        esError: false,
      })

      // THEN la tarjeta terminada muestra su resultado y la otra permanece en curso hasta completar
      expect(estado.herramientasEnCurso).toHaveLength(2)
      expect(estado.herramientasEnCurso[0]?.completada).toBe(false)
      expect(estado.herramientasEnCurso[1]?.completada).toBe(true)
      expect(estado.herramientasEnCurso[1]?.resultado).toBe('contenido_rapido')
    })

    it('El orden de las tarjetas es el de las llamadas', async () => {
      // WHEN una tanda termina con llamadas que duraron distinto tiempo
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'read',
        admiteParalelo: true,
        obtenerRecurso: (args) => String(args.ruta ?? '*'),
        ejecutar: async (args) => {
          const r = String(args.ruta)
          if (r === 'primero.ts') {
            await new Promise((resolve) => setTimeout(resolve, 30))
          } else {
            await new Promise((resolve) => setTimeout(resolve, 5))
          }
          return `leido:${r}`
        },
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'c_1',
                nombre: 'read',
                argumentos: { ruta: 'primero.ts' },
              },
              {
                id: 'c_2',
                nombre: 'read',
                argumentos: { ruta: 'segundo.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Listo'] },
        ],
      })

      const sesion = new SesionInteractiva({
        proveedor,
        registro,
      })

      await sesion.enviarMensaje('lee ambos')

      // THEN las tarjetas quedan ordenadas según el orden en que el modelo las pidió
      const tarjetas = sesion
        .obtenerEstado()
        .historial.filter((e) => e.tipo === 'herramienta')
      expect(
        tarjetas.map((t) => (t.tipo === 'herramienta' ? t.resultado : '')),
      ).toEqual(['leido:primero.ts', 'leido:segundo.ts'])
    })
  })
})
