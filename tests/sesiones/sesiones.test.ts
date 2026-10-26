import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DefinicionAgente } from '../../src/agents/definiciones.js'
import { construirHarness } from '../../src/app.js'
import { RegistroHerramientas } from '../../src/core/registry.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { AlmacenSesiones } from '../../src/sesiones/almacen.js'
import {
  parsearRegistro,
  type RegistroSesion,
} from '../../src/sesiones/formato.js'

interface OpcionesAlmacenPrueba {
  maximo?: number | undefined
  ids?: string[] | undefined
  fechas?: string[] | undefined
}

function crearAlmacen(
  directorio: string,
  opciones: OpcionesAlmacenPrueba = {},
): AlmacenSesiones {
  let indice = 0
  let fecha = 0
  const base = Date.parse('2026-10-26T10:00:00.000Z')
  return new AlmacenSesiones({
    directorioProyecto: directorio,
    ...(opciones.maximo !== undefined ? { maximo: opciones.maximo } : {}),
    ahora: () => {
      const indiceFecha = fecha++
      const fijada = opciones.fechas?.[indiceFecha]
      return new Date(
        fijada ? Date.parse(fijada) : base + (indiceFecha + 1) * 60_000,
      )
    },
    generarId: () => opciones.ids?.[indice++] ?? `sesion-${indice}`,
  })
}

function crearSesion(
  almacen: AlmacenSesiones,
  respuestas: ConstructorParameters<typeof ProveedorSimulado>[0] = {},
  extras: Partial<ConstructorParameters<typeof SesionInteractiva>[0]> = {},
): SesionInteractiva {
  return new SesionInteractiva({
    proveedor: new ProveedorSimulado({
      respuestas: [{ fragmentosTexto: ['respuesta'] }],
      ...respuestas,
    }),
    registro: new RegistroHerramientas(),
    ventanaContexto: 20_000,
    almacen,
    ...extras,
  })
}

function leerRegistros(almacen: AlmacenSesiones, id: string): RegistroSesion[] {
  return readFileSync(almacen.rutaEventos(id), 'utf-8')
    .split('\n')
    .filter((linea) => linea.trim() !== '')
    .map((linea) => parsearRegistro(linea))
    .filter((registro): registro is RegistroSesion => Boolean(registro))
}

describe('sesiones Specification Tests', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-sesiones-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // -------------------------------------------------------------------------
  // Requirement: La sesión se guarda de forma incremental al cerrar cada turno
  // -------------------------------------------------------------------------
  describe('Requirement: La sesión se guarda de forma incremental al cerrar cada turno', () => {
    it('Un turno completado se guarda', async () => {
      // WHEN un turno termina con estado completado
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const sesion = crearSesion(almacen)
      await sesion.enviarMensaje('hola')

      // THEN sus mensajes quedan agregados a la sesión activa
      const id = sesion.obtenerSesionId()
      expect(id).toBe('s1')
      const registros = leerRegistros(almacen, id as string)
      expect(registros).toHaveLength(1)
      expect(registros[0]?.tipo).toBe('turno')
      expect(almacen.cargar(id as string).mensajes).toHaveLength(2)
    })

    it('Un turno cancelado se guarda', () => {
      // WHEN el usuario cancela un turno y el turno cierra con estado cancelado
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(metadata.id, 'cancelado', [
        { rol: 'user', contenido: 'pedido' },
        { rol: 'assistant', contenido: 'parcial' },
      ])

      // THEN los mensajes producidos hasta la cancelación quedan agregados a la sesión
      const cargada = almacen.cargar(metadata.id)
      expect(cargada.mensajes).toHaveLength(2)
      expect(leerRegistros(almacen, metadata.id)[0]).toMatchObject({
        tipo: 'turno',
        estado: 'cancelado',
      })
    })

    it('Los registros anteriores no se reescriben', async () => {
      // WHEN se guarda un turno nuevo sobre una sesión con turnos previos
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(metadata.id, 'completado', [
        { rol: 'user', contenido: 'uno' },
      ])
      const antes = readFileSync(almacen.rutaEventos(metadata.id), 'utf-8')

      almacen.guardarTurno(metadata.id, 'completado', [
        { rol: 'user', contenido: 'dos' },
      ])

      // THEN los registros anteriores permanecen intactos
      const despues = readFileSync(almacen.rutaEventos(metadata.id), 'utf-8')
      expect(despues.startsWith(antes)).toBe(true)
      expect(despues.split('\n').filter(Boolean)).toHaveLength(2)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Un registro incompleto se descarta sin romper la sesión
  // -------------------------------------------------------------------------
  describe('Requirement: Un registro incompleto se descarta sin romper la sesión', () => {
    it('Un corte a mitad del último turno', () => {
      // WHEN el proceso muere mientras escribe el último turno y ese registro queda incompleto
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(metadata.id, 'completado', [
        { rol: 'user', contenido: 'guardado' },
      ])
      const ruta = almacen.rutaEventos(metadata.id)
      const previo = readFileSync(ruta, 'utf-8')
      writeFileSync(ruta, `${previo}{"tipo":"turno","estado":"comple`, 'utf-8')

      // THEN al cargar se descarta ese turno y la sesión anterior sigue disponible
      const cargada = almacen.cargar(metadata.id)
      expect(cargada.mensajes).toHaveLength(1)
      expect(cargada.mensajes[0]?.contenido).toBe('guardado')
    })

    it('Un registro corrupto en el medio', () => {
      // WHEN un registro intermedio no se puede interpretar
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(metadata.id, 'completado', [
        { rol: 'user', contenido: 'uno' },
      ])
      const ruta = almacen.rutaEventos(metadata.id)
      const lineas = readFileSync(ruta, 'utf-8').trim().split('\n')
      lineas.push('esto no es json')
      lineas.push(
        JSON.stringify({
          tipo: 'turno',
          estado: 'completado',
          mensajes: [{ rol: 'user', contenido: 'tres' }],
        }),
      )
      writeFileSync(ruta, `${lineas.join('\n')}\n`, 'utf-8')

      // THEN la carga falla y devuelve un error en lugar de perder datos en silencio
      expect(() => almacen.cargar(metadata.id)).toThrow(/registro inválido/)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Al reanudar se restauran el historial y la configuración
  // -------------------------------------------------------------------------
  describe('Requirement: Al reanudar se restauran el historial y la configuración', () => {
    it('Reanudar conserva el historial', async () => {
      // WHEN se reanuda una sesión con turnos previos
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const primera = crearSesion(almacen)
      await primera.enviarMensaje('primero')
      const id = primera.obtenerSesionId() as string

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['segundo'] }],
      })
      const reanudada = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
        ventanaContexto: 20_000,
        almacen,
        sesionInicial: almacen.cargar(id),
      })
      await reanudada.enviarMensaje('siguiente')

      // THEN el siguiente turno se envía con ese historial y sin inventar mensajes
      const enviados = proveedor.peticionesRecibidas[0]?.mensajes ?? []
      expect(enviados).toHaveLength(3)
      expect(enviados[0]?.contenido).toBe('primero')
      expect(enviados[2]?.contenido).toBe('siguiente')
    })

    it('Reanudar restaura el modelo y el agente', () => {
      // WHEN la sesión se guardó con un modelo y un agente distintos de los iniciales
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({
        modelo: 'openrouter/otro/modelo',
        agente: 'plan',
      })
      const agentes: DefinicionAgente[] = [
        {
          nombre: 'build',
          descripcion: 'construye',
          modo: 'primario',
          herramientas: [],
        },
        {
          nombre: 'plan',
          descripcion: 'planea',
          modo: 'primario',
          herramientas: [],
        },
      ]
      const proveedor = new ProveedorSimulado({ nombre: 'openrouter' })
      const reanudada = new SesionInteractiva({
        proveedor,
        registro: new RegistroHerramientas(),
        ventanaContexto: 20_000,
        almacen,
        sesionInicial: almacen.cargar(metadata.id),
        agentes,
        agenteActivo: 'build',
        fabricaProveedor: () => ({
          proveedor: new ProveedorSimulado({
            nombre: 'openrouter',
            modelo: 'otro/modelo',
          }),
          ventanaContexto: 40_000,
        }),
      })

      // THEN al reanudar quedan activos ese modelo y ese agente
      expect(reanudada.obtenerModeloActivo()).toBe('openrouter/otro/modelo')
      expect(reanudada.obtenerAgenteActivo()).toBe('plan')
    })

    it('Reanudar funciona sin terminal interactiva', async () => {
      // WHEN se reanuda una sesión desde la línea de comandos sin terminal interactiva
      const config = { proveedores: {} }
      const registro = new RegistroHerramientas()
      const primero = construirHarness({
        directorioProyecto: tempDir,
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['guardado'] }],
        }),
        registro,
        config,
        esInteractivo: false,
      })
      await primero.sesion.enviarMensaje('hola')
      const id = primero.sesion.obtenerSesionId()

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['reanudado'] }],
      })
      const segundo = construirHarness({
        directorioProyecto: tempDir,
        proveedor,
        registro,
        config,
        esInteractivo: false,
        continuar: true,
      })
      await segundo.sesion.enviarMensaje('sigue')

      // THEN el historial se restaura igual y el turno se ejecuta en modo línea a línea
      expect(segundo.sesion.obtenerSesionId()).toBe(id)
      expect(proveedor.peticionesRecibidas[0]?.mensajes).toHaveLength(3)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La credencial nunca se escribe en la sesión
  // -------------------------------------------------------------------------
  describe('Requirement: La credencial nunca se escribe en la sesión', () => {
    it('Un resultado que contiene la credencial se guarda redactado', () => {
      // WHEN un resultado de herramienta incluye la credencial configurada
      const secreto = 'sk-secreto-1234'
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(
        metadata.id,
        'completado',
        [{ rol: 'tool', resultado: `falló con ${secreto}` }],
        [secreto],
      )

      // THEN el registro guardado contiene la credencial redactada
      const crudo = readFileSync(almacen.rutaEventos(metadata.id), 'utf-8')
      expect(crudo).not.toContain(secreto)
      expect(crudo).toContain('[REDACTADO]')
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Se pueden listar y elegir sesiones guardadas
  // -------------------------------------------------------------------------
  describe('Requirement: Se pueden listar y elegir sesiones guardadas', () => {
    it('Se listan las sesiones del proyecto', () => {
      // WHEN el usuario pide la lista de sesiones
      const almacen = crearAlmacen(tempDir, { ids: ['s1', 's2'] })
      almacen.crear({ modelo: 'm1', agente: 'build' })
      almacen.crear({ modelo: 'm2', agente: 'build' })

      // THEN recibe las sesiones del proyecto ordenadas por actualización descendente
      expect(almacen.listar().map((sesion) => sesion.id)).toEqual(['s2', 's1'])
    })

    it('Se carga la última sesión', () => {
      // WHEN el usuario pide continuar sin indicar identificador
      const almacen = crearAlmacen(tempDir, { ids: ['s1', 's2'] })
      almacen.crear({ modelo: 'm1', agente: 'build' })
      almacen.crear({ modelo: 'm2', agente: 'build' })

      // THEN se carga la sesión del proyecto actualizada más recientemente
      expect(almacen.ultima(tempDir)?.id).toBe('s2')
    })

    it('Un identificador inexistente vuelve como error', () => {
      // WHEN el usuario pide una sesión cuyo identificador no existe
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const sesion = crearSesion(almacen)
      const activa = sesion.obtenerSesionId()

      // THEN el sistema no cambia de sesión y devuelve un mensaje de error
      expect(() => sesion.cambiarSesion('no-existe')).toThrow(/no existe/)
      expect(sesion.obtenerSesionId()).toBe(activa)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: Una sesión nueva no hereda el historial de la anterior
  // -------------------------------------------------------------------------
  describe('Requirement: Una sesión nueva no hereda el historial de la anterior', () => {
    it('Crear una sesión nueva', async () => {
      // WHEN el usuario pide una sesión nueva
      const almacen = crearAlmacen(tempDir, { ids: ['s1', 's2'] })
      const sesion = crearSesion(almacen)
      await sesion.enviarMensaje('hola')
      const anterior = sesion.obtenerSesionId() as string

      const nueva = sesion.nuevaSesion()

      // THEN la sesión activa arranca sin mensajes y la anterior sigue guardada
      expect(nueva).not.toBe(anterior)
      expect(
        sesion
          .obtenerEstado()
          .historial.filter((item) => item.tipo !== 'aviso'),
      ).toHaveLength(0)
      expect(almacen.cargar(anterior).mensajes.length).toBeGreaterThan(0)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: El guardado se puede desactivar
  // -------------------------------------------------------------------------
  describe('Requirement: El guardado se puede desactivar', () => {
    it('El guardado desactivado no escribe', async () => {
      // WHEN la configuración desactiva el guardado
      const { sesion } = construirHarness({
        directorioProyecto: tempDir,
        proveedor: new ProveedorSimulado({
          respuestas: [{ fragmentosTexto: ['ok'] }],
        }),
        registro: new RegistroHerramientas(),
        config: { proveedores: {}, sesiones: { guardar: false } },
      })
      await sesion.enviarMensaje('hola')

      // THEN un turno no crea ni modifica archivos de sesión
      expect(sesion.obtenerSesionId()).toBeUndefined()
      expect(existsSync(join(tempDir, '.harness', 'sesiones'))).toBe(false)
    })

    it('El guardado activo escribe por defecto', () => {
      // WHEN la configuración no dice nada sobre el guardado
      const { sesion } = construirHarness({
        directorioProyecto: tempDir,
        proveedor: new ProveedorSimulado(),
        registro: new RegistroHerramientas(),
        config: { proveedores: {} },
      })

      // THEN un turno terminado queda guardado
      const id = sesion.obtenerSesionId()
      expect(id).toBeDefined()
      expect(
        existsSync(join(tempDir, '.harness', 'sesiones', id as string)),
      ).toBe(true)
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La compactación reemplaza el historial al reanudar
  // -------------------------------------------------------------------------
  describe('Requirement: La compactación reemplaza el historial al reanudar', () => {
    it('Reanudar después de compactar no revive el historial viejo', () => {
      // WHEN una sesión se compactó y después se reanuda
      const almacen = crearAlmacen(tempDir, { ids: ['s1'] })
      const metadata = almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.guardarTurno(metadata.id, 'completado', [
        { rol: 'user', contenido: 'viejo' },
      ])
      almacen.guardarCompactacion(metadata.id, [
        { rol: 'user', contenido: 'resumen' },
      ])

      // THEN el historial cargado es el compactado, no el original
      expect(almacen.cargar(metadata.id).mensajes).toEqual([
        { rol: 'user', contenido: 'resumen' },
      ])
    })
  })

  // -------------------------------------------------------------------------
  // Requirement: La cantidad de sesiones guardadas está acotada
  // -------------------------------------------------------------------------
  describe('Requirement: La cantidad de sesiones guardadas está acotada', () => {
    it('Se eliminan las sesiones más antiguas', () => {
      // WHEN se crea una sesión nueva y ya se alcanzó el máximo configurado
      const almacen = crearAlmacen(tempDir, {
        maximo: 2,
        ids: ['vieja', 'media', 'nueva'],
      })
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.crear({ modelo: 'm', agente: 'build' })

      // THEN se eliminan las sesiones más antiguas y la nueva queda guardada
      expect(almacen.listar().map((sesion) => sesion.id)).toEqual([
        'nueva',
        'media',
      ])
      expect(existsSync(almacen.rutaSesion('vieja'))).toBe(false)
    })

    it('La sesión activa no se elimina', () => {
      // WHEN la poda alcanza a la sesión activa
      const almacen = crearAlmacen(tempDir, {
        maximo: 2,
        ids: ['s1', 's2', 'activa'],
        fechas: [
          '2026-10-26T10:00:00.000Z',
          '2026-10-26T11:00:00.000Z',
          '2026-10-26T09:00:00.000Z',
        ],
      })
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.crear({ modelo: 'm', agente: 'build' })
      almacen.crear({ modelo: 'm', agente: 'build' })

      // THEN el sistema la conserva y elimina otra más antigua
      expect(existsSync(almacen.rutaSesion('activa'))).toBe(true)
      expect(existsSync(almacen.rutaSesion('s2'))).toBe(true)
      expect(existsSync(almacen.rutaSesion('s1'))).toBe(false)
    })
  })
})
