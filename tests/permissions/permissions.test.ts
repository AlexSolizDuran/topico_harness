import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DefinicionAgente } from '../../src/agents/definiciones.js'
import {
  despacharHerramienta,
  ejecutarTurno,
  RegistroHerramientas,
} from '../../src/core/index.js'
import { SesionInteractiva } from '../../src/interface/runner.js'
import {
  coincidePatronPermiso,
  combinarReglasPermiso,
  evaluarOperacionPermiso,
  evaluarReglasOrdenadas,
  GestorPermisos,
} from '../../src/permissions/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { crearHerramientaDelegacion } from '../../src/subagents/herramienta.js'
import { crearCatalogoPorDefecto } from '../../src/tools/catalog.js'
import type { EstadoTurno, EventoTurno, ReglaPermiso } from '../../src/types.js'

async function consumirTurnoCompleto(
  generador: AsyncGenerator<EventoTurno, EstadoTurno, unknown>,
): Promise<EstadoTurno> {
  let iter = await generador.next()
  while (!iter.done) {
    iter = await generador.next()
  }
  return iter.value
}

describe('permissions Specification Tests', () => {
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-permissions-test-'))
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  // --------------------------------------------------------------------------
  // Requirement: Los permisos son reglas ordenadas y serializables
  // --------------------------------------------------------------------------
  describe('Requirement: Los permisos son reglas ordenadas y serializables', () => {
    it('La regla específica después de la amplia gana', () => {
      const reglas: ReglaPermiso[] = [
        { accion: 'edit', recurso: 'src/*', efecto: 'permitir' },
        { accion: 'edit', recurso: 'src/secreto.ts', efecto: 'denegar' },
      ]

      expect(evaluarReglasOrdenadas('edit', 'src/app.ts', reglas)).toBe(
        'permitir',
      )
      expect(evaluarReglasOrdenadas('edit', 'src/secreto.ts', reglas)).toBe(
        'denegar',
      )
    })

    it('Sin coincidencia se consulta', () => {
      const reglas: ReglaPermiso[] = [
        { accion: 'read', recurso: 'docs/*', efecto: 'permitir' },
      ]

      expect(evaluarReglasOrdenadas('edit', 'src/main.ts', reglas)).toBe(
        'consultar',
      )
    })

    it('Una regla nueva no requiere tocar el código', async () => {
      const dir = mkdtempSync(join(tempDir, 'regla-archivo-'))
      mkdirSync(join(dir, '.harness'), { recursive: true })
      writeFileSync(
        join(dir, '.harness', 'permissions.json'),
        JSON.stringify([
          { accion: 'shell', recurso: 'git push *', efecto: 'denegar' },
        ]),
        'utf-8',
      )

      const gestor = new GestorPermisos({ directorioProyecto: dir })
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: dir })
      const toolShell = catalogo.obtener('shell')
      if (!toolShell) throw new Error('shell no encontrada')

      const evalPush = gestor.evaluar(toolShell, {
        comando: 'git push origin main',
      })
      expect(evalPush.efecto).toBe('denegar')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Los patrones comparan el valor completo
  // --------------------------------------------------------------------------
  describe('Requirement: Los patrones comparan el valor completo', () => {
    it('El comodín cubre toda la ruta', () => {
      expect(
        coincidePatronPermiso('src/*', 'src/interface/app.tsx', true),
      ).toBe(true)
    })

    it('Un comando sin argumentos coincide con el patrón terminado en espacio y comodín', () => {
      expect(coincidePatronPermiso('git status *', 'git status')).toBe(true)
      expect(coincidePatronPermiso('git status *', 'git status --short')).toBe(
        true,
      )
    })

    it('La ruta se normaliza antes de comparar', () => {
      expect(
        coincidePatronPermiso('src/tools/*', 'src\\tools\\./read.ts', true),
      ).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La acción agrupa las herramientas por lo que hacen
  // --------------------------------------------------------------------------
  describe('Requirement: La acción agrupa las herramientas por lo que hacen', () => {
    it('Escribir y editar comparten la acción edit', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const gestor = new GestorPermisos({
        incluirBase: false,
        reglasGlobales: [
          { accion: 'edit', recurso: 'src/*', efecto: 'permitir' },
        ],
      })

      const writeTool = catalogo.obtener('write')
      const editTool = catalogo.obtener('edit')
      if (!writeTool || !editTool)
        throw new Error('herramientas no encontradas')

      expect(gestor.evaluar(writeTool, { ruta: 'src/a.ts' }).efecto).toBe(
        'permitir',
      )
      expect(gestor.evaluar(editTool, { ruta: 'src/a.ts' }).efecto).toBe(
        'permitir',
      )
    })

    it('Buscar archivos y buscar texto tienen acciones propias', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const gestor = new GestorPermisos({
        incluirBase: false,
        reglasGlobales: [{ accion: 'read', recurso: '*', efecto: 'permitir' }],
      })

      const globTool = catalogo.obtener('glob')
      const grepTool = catalogo.obtener('grep')
      if (!globTool || !grepTool) throw new Error('herramientas no encontradas')

      expect(gestor.evaluar(globTool, { patron: '*.ts' }).efecto).toBe(
        'consultar',
      )
      expect(gestor.evaluar(grepTool, { cadena: 'hola' }).efecto).toBe(
        'consultar',
      )
    })

    it('La delegación usa la acción subagent', () => {
      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => [
          {
            nombre: 'explore',
            descripcion: 'Explorador',
            modo: 'subagente',
            herramientas: ['read'],
          },
        ],
        obtenerCatalogo: () => new RegistroHerramientas(),
        obtenerProveedorPadre: () => new ProveedorSimulado(),
      })

      const gestor = new GestorPermisos({
        reglasGlobales: [
          { accion: 'subagent', recurso: 'explore', efecto: 'denegar' },
        ],
      })

      const ev = gestor.evaluar(toolTask, {
        agent: 'explore',
        prompt: 'buscá',
      })
      expect(ev.accion).toBe('subagent')
      expect(ev.recurso).toBe('explore')
      expect(ev.efecto).toBe('denegar')
    })

    it('Ejecutar y ejecutar compuesto son acciones distintas', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const shellTool = catalogo.obtener('shell')
      if (!shellTool) throw new Error('herramienta no encontrada')

      const gestor = new GestorPermisos({
        incluirBase: false,
        reglasGlobales: [{ accion: 'shell', recurso: '*', efecto: 'permitir' }],
      })

      expect(gestor.evaluar(shellTool, { comando: 'git status' }).efecto).toBe(
        'permitir',
      )
      expect(
        gestor.evaluar(shellTool, { comando: 'git status && npm test' }).efecto,
      ).toBe('consultar')
    })

    it('Ejecutar con redirección es una acción propia', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const shellTool = catalogo.obtener('shell')
      if (!shellTool) throw new Error('herramienta no encontrada')

      const gestor = new GestorPermisos({
        incluirBase: false,
        reglasGlobales: [{ accion: 'shell', recurso: '*', efecto: 'permitir' }],
      })

      expect(gestor.evaluar(shellTool, { comando: 'git status' }).efecto).toBe(
        'permitir',
      )
      const redirigido = gestor.evaluar(shellTool, {
        comando: 'git status > salida.txt',
      })
      expect(redirigido.accion).toBe('shell_redireccion')
      expect(redirigido.efecto).toBe('consultar')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La política base permite y protege los secretos
  // --------------------------------------------------------------------------
  describe('Requirement: La política base permite y protege los secretos', () => {
    it('Un archivo común se lee sin preguntar', () => {
      const res = evaluarOperacionPermiso({
        accion: 'read',
        recursos: 'src/main.ts',
      })
      expect(res.efecto).toBe('permitir')
    })

    it('Un archivo .env consulta', () => {
      expect(
        evaluarOperacionPermiso({ accion: 'read', recursos: '.env' }).efecto,
      ).toBe('consultar')
      expect(
        evaluarOperacionPermiso({ accion: 'read', recursos: '.env.local' })
          .efecto,
      ).toBe('consultar')
    })

    it('Un archivo .env.example se permite', () => {
      expect(
        evaluarOperacionPermiso({ accion: 'read', recursos: '.env.example' })
          .efecto,
      ).toBe('permitir')
      expect(
        evaluarOperacionPermiso({
          accion: 'read',
          recursos: 'config/.env.example',
        }).efecto,
      ).toBe('permitir')
    })

    it('Una ruta externa se permite por defecto', () => {
      expect(
        evaluarOperacionPermiso({
          accion: 'read',
          recursos: '../otro-proyecto/readme.md',
          directorioProyecto: tempDir,
        }).efecto,
      ).toBe('permitir')

      expect(
        evaluarOperacionPermiso({
          accion: 'read',
          recursos: '../otro-proyecto/readme.md',
          directorioProyecto: tempDir,
          reglasGlobales: [
            {
              accion: 'external_directory',
              recurso: '*',
              efecto: 'consultar',
            },
          ],
        }).efecto,
      ).toBe('consultar')
    })

    it('Un comando compuesto consulta aunque la base permita ejecutar', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const shellTool = catalogo.obtener('shell')
      if (!shellTool) throw new Error('herramienta no encontrada')

      const gestor = new GestorPermisos({})
      const ev = gestor.evaluar(shellTool, {
        comando: 'git status && npm test',
      })

      expect(ev.accion).toBe('shell_compuesto')
      expect(ev.efecto).toBe('consultar')
      expect(ev.recurso).toBe('git status && npm test')
    })

    it('Una redirección consulta aunque la base permita ejecutar', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const shellTool = catalogo.obtener('shell')
      if (!shellTool) throw new Error('herramienta no encontrada')

      const gestor = new GestorPermisos({})
      const ev = gestor.evaluar(shellTool, {
        comando: 'git status > salida.txt',
      })

      expect(ev.accion).toBe('shell_redireccion')
      expect(ev.efecto).toBe('consultar')
      expect(ev.recurso).toBe('git status > salida.txt')
    })

    it('Un comando simple no consulta', () => {
      const catalogo = crearCatalogoPorDefecto({ directorioProyecto: tempDir })
      const shellTool = catalogo.obtener('shell')
      if (!shellTool) throw new Error('herramienta no encontrada')

      const gestor = new GestorPermisos({})
      expect(gestor.evaluar(shellTool, { comando: 'git status' }).efecto).toBe(
        'permitir',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Las reglas del agente se agregan después de las globales
  // --------------------------------------------------------------------------
  describe('Requirement: Las reglas del agente se agregan después de las globales', () => {
    it('La regla del agente gana sobre la global', () => {
      const globales: ReglaPermiso[] = [
        { accion: 'edit', recurso: '*', efecto: 'permitir' },
      ]
      const delAgente: ReglaPermiso[] = [
        { accion: 'edit', recurso: '*', efecto: 'consultar' },
      ]

      expect(combinarReglasPermiso(globales, delAgente)).toHaveLength(2)
      const res = evaluarOperacionPermiso({
        accion: 'edit',
        recursos: 'src/index.ts',
        reglasGlobales: globales,
        reglasAgente: delAgente,
      })
      expect(res.efecto).toBe('consultar')
    })

    it('Las reglas globales siguen vigentes con otro agente', () => {
      const globales: ReglaPermiso[] = [
        { accion: 'shell', recurso: 'git push *', efecto: 'denegar' },
      ]

      const res = evaluarOperacionPermiso({
        accion: 'shell',
        recursos: 'git push origin main',
        reglasGlobales: globales,
        reglasAgente: [],
      })
      expect(res.efecto).toBe('denegar')
    })

    it('Un subagente usa sus propias reglas', async () => {
      const catalogo = new RegistroHerramientas()
      let leido = false
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'read',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        ejecutar: async () => {
          leido = true
          return 'contenido'
        },
      })

      const subagenteRestringido: DefinicionAgente = {
        nombre: 'explore',
        descripcion: 'Explorador con regla propia',
        modo: 'subagente',
        herramientas: ['read'],
        permisos: [
          { accion: 'read', recurso: 'restringido.txt', efecto: 'denegar' },
        ],
      }

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'h1',
                nombre: 'read',
                argumentos: { ruta: 'restringido.txt' },
              },
            ],
          },
          { fragmentosTexto: ['El permiso me frenó'] },
        ],
      })

      const toolTask = crearHerramientaDelegacion({
        obtenerAgentes: () => [subagenteRestringido],
        obtenerCatalogo: () => catalogo,
        obtenerProveedorPadre: () => proveedorHijo,
        crearPorteroSubagente: (sub) =>
          new GestorPermisos({ reglasAgente: sub.permisos }),
      })

      const salida = await toolTask.ejecutar({
        agent: 'explore',
        prompt: 'leé restringido.txt',
      })

      expect(leido).toBe(false)
      expect(salida).toBe('El permiso me frenó')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Denegar impide la ejecución y el rechazo vuelve como texto
  // --------------------------------------------------------------------------
  describe('Requirement: Denegar impide la ejecución y el rechazo vuelve como texto', () => {
    it('Una operación denegada no se ejecuta', async () => {
      let ejecutada = false
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'write',
        descripcion: 'escribe',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'edit',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        ejecutar: async () => {
          ejecutada = true
          return 'escrito'
        },
      })

      const portero = new GestorPermisos({
        reglasGlobales: [
          { accion: 'edit', recurso: 'protegido.ts', efecto: 'denegar' },
        ],
      })

      const res = await despacharHerramienta(
        'write',
        { ruta: 'protegido.ts' },
        registro,
        { portero },
      )

      expect(ejecutada).toBe(false)
      expect(res.esError).toBe(true)
      expect(res.resultado).toContain('denegado')
      expect(res.resultado).toContain('protegido.ts')
    })

    it('Un recurso denegado deniega toda la operación', () => {
      const res = evaluarOperacionPermiso({
        accion: 'edit',
        recursos: ['src/a.ts', 'src/bloqueado.ts', 'src/b.ts'],
        reglasGlobales: [
          { accion: 'edit', recurso: 'src/bloqueado.ts', efecto: 'denegar' },
        ],
      })

      expect(res.efecto).toBe('denegar')
      expect(res.recurso).toBe('src/bloqueado.ts')
    })

    it('El modelo recibe el motivo y sigue el turno', async () => {
      const registro = new RegistroHerramientas()
      registro.registrar({
        nombre: 'write',
        descripcion: 'escribe',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'edit',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        ejecutar: async () => 'ok',
      })

      const portero = new GestorPermisos({
        reglasGlobales: [
          { accion: 'edit', recurso: 'secreto.ts', efecto: 'denegar' },
        ],
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'c1',
                nombre: 'write',
                argumentos: { ruta: 'secreto.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Entendido, no toco secreto.ts'] },
        ],
      })

      const estado = await consumirTurnoCompleto(
        ejecutarTurno({
          proveedor,
          registro,
          mensajes: [{ rol: 'user', contenido: 'editá secreto.ts' }],
          portero,
        }),
      )

      expect(estado.tipo).toBe('completado')
      expect(estado.pasosEjecutados).toBe(2)
      const toolMsg = estado.mensajes.find((m) => m.rol === 'tool')
      expect(toolMsg?.resultado).toContain('denegado')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Una aprobación espera la decisión y ofrece las salidas que corresponden
  // --------------------------------------------------------------------------
  describe('Requirement: Una aprobación espera la decisión y ofrece las salidas que corresponden', () => {
    it('Aprobar una vez ejecuta solo esa solicitud', async () => {
      let consultas = 0
      const gestor = new GestorPermisos({
        reglasGlobales: [
          { accion: 'edit', recurso: 'src/*', efecto: 'consultar' },
        ],
        manejadorAprobacion: async () => {
          consultas++
          return 'una_vez'
        },
      })

      const registro = new RegistroHerramientas()
      let ejecuciones = 0
      registro.registrar({
        nombre: 'write',
        descripcion: 'escribe',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'edit',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        ejecutar: async () => {
          ejecuciones++
          return 'ok'
        },
      })

      await despacharHerramienta('write', { ruta: 'src/a.ts' }, registro, {
        portero: gestor,
      })
      await despacharHerramienta('write', { ruta: 'src/a.ts' }, registro, {
        portero: gestor,
      })

      expect(ejecuciones).toBe(2)
      expect(consultas).toBe(2)
    })

    it('Aprobar siempre guarda una regla del proyecto', async () => {
      const dir = mkdtempSync(join(tempDir, 'aprobar-siempre-'))
      let consultas = 0
      const gestor = new GestorPermisos({
        directorioProyecto: dir,
        reglasGlobales: [
          { accion: 'shell', recurso: 'npm test *', efecto: 'consultar' },
        ],
        manejadorAprobacion: async () => {
          consultas++
          return 'siempre'
        },
      })

      const registro = new RegistroHerramientas()
      let ejecuciones = 0
      registro.registrar({
        nombre: 'shell',
        descripcion: 'shell',
        esquema: {
          type: 'object',
          properties: { comando: { type: 'string' } },
          required: ['comando'],
        },
        accionPermiso: 'shell',
        obtenerRecurso: (args) => String(args.comando ?? ''),
        ejecutar: async () => {
          ejecuciones++
          return 'tests ok'
        },
      })

      await despacharHerramienta(
        'shell',
        { comando: 'npm test unit' },
        registro,
        { portero: gestor },
      )
      await despacharHerramienta(
        'shell',
        { comando: 'npm test integration' },
        registro,
        { portero: gestor },
      )

      expect(ejecuciones).toBe(2)
      expect(consultas).toBe(1)

      // Recargar en otra instancia verifica persistencia durable en el proyecto
      const otroGestor = new GestorPermisos({
        directorioProyecto: dir,
        reglasGlobales: [
          { accion: 'shell', recurso: 'npm test *', efecto: 'consultar' },
        ],
      })
      const shellTool = registro.obtener('shell')
      if (!shellTool) throw new Error('shell no encontrada')
      const ev = otroGestor.evaluar(shellTool, {
        comando: 'npm test e2e',
      })
      expect(ev.efecto).toBe('permitir')
    })

    it('Una aprobación guardada no pisa un deny configurado', () => {
      const gestor = new GestorPermisos({
        reglasGlobales: [
          { accion: 'edit', recurso: 'src/critico.ts', efecto: 'denegar' },
        ],
        aprobacionesIniciales: [
          { accion: 'edit', recurso: 'src/*', efecto: 'permitir' },
          { accion: 'edit', recurso: 'src/critico.ts', efecto: 'permitir' },
        ],
      })

      const ev = gestor.evaluar(
        {
          nombre: 'write',
          accionPermiso: 'edit',
          obtenerRecurso: () => 'src/critico.ts',
        },
        {},
      )
      expect(ev.efecto).toBe('denegar')
    })

    it('Denegar rechaza las demás solicitudes pendientes', async () => {
      const resoluciones: Array<
        (d: 'una_vez' | 'siempre' | 'denegar') => void
      > = []
      const gestor = new GestorPermisos({
        reglasGlobales: [{ accion: 'read', recurso: '*', efecto: 'consultar' }],
        manejadorAprobacion: () =>
          new Promise((resolve) => {
            resoluciones.push(resolve)
          }),
      })

      const p1 = gestor.solicitarAprobacion({
        id: '1',
        herramienta: 'read',
        accion: 'read',
        recurso: 'a.env',
        patronSugerido: 'a.env',
        obligatoria: false,
      })
      const p2 = gestor.solicitarAprobacion({
        id: '2',
        herramienta: 'read',
        accion: 'read',
        recurso: 'b.env',
        patronSugerido: 'b.env',
        obligatoria: false,
      })

      resoluciones[0]?.('denegar')

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe('denegar')
      expect(r2).toBe('denegar')
    })

    it('Una aprobación obligatoria no ofrece aprobar siempre', () => {
      const gestor = new GestorPermisos({})
      const ev = gestor.evaluar(
        {
          nombre: 'shell',
          accionPermiso: 'shell',
          obtenerRecurso: () => 'rm archivo.txt',
          motivoAprobacionObligatoria: () => 'lista negra',
        },
        { comando: 'rm archivo.txt' },
      )

      expect(ev.efecto).toBe('consultar')
      expect(ev.obligatoria).toBe(true)
      expect(ev.motivo).toBe('lista negra')
    })

    it('Aprobar siempre en una obligatoria no guarda una regla', async () => {
      const dir = mkdtempSync(join(tempDir, 'obligatoria-siempre-'))
      let consultas = 0
      const gestor = new GestorPermisos({
        directorioProyecto: dir,
        manejadorAprobacion: async () => {
          consultas++
          return 'siempre'
        },
      })

      const registro = new RegistroHerramientas()
      let ejecuciones = 0
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'read',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        motivoAprobacionObligatoria: () => 'archivo protegido',
        ejecutar: async () => {
          ejecuciones++
          return 'ok'
        },
      })

      await despacharHerramienta('read', { ruta: '.env' }, registro, {
        portero: gestor,
      })
      await despacharHerramienta('read', { ruta: '.env' }, registro, {
        portero: gestor,
      })

      expect(ejecuciones).toBe(2)
      expect(consultas).toBe(2)
      expect(gestor.obtenerAprobacionesGuardadas()).toHaveLength(0)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Hay operaciones que siempre piden aprobación
  // --------------------------------------------------------------------------
  describe('Requirement: Hay operaciones que siempre piden aprobación', () => {
    const herramientaRiesgosa = {
      nombre: 'shell',
      accionPermiso: 'shell' as const,
      obtenerRecurso: (args: Record<string, unknown>) =>
        String(args.comando ?? ''),
      motivoAprobacionObligatoria: () =>
        'El comando pertenece a la lista negra.',
    }

    it('Una regla permitir no salta la aprobación', () => {
      const gestor = new GestorPermisos({
        reglasGlobales: [{ accion: 'shell', recurso: '*', efecto: 'permitir' }],
      })

      const ev = gestor.evaluar(herramientaRiesgosa, {
        comando: 'rm archivo.txt',
      })

      expect(ev.efecto).toBe('consultar')
      expect(ev.obligatoria).toBe(true)
    })

    it('Una aprobación guardada no salta la aprobación', () => {
      const gestor = new GestorPermisos({
        aprobacionesIniciales: [
          { accion: 'shell', recurso: '*', efecto: 'permitir' },
        ],
      })

      const ev = gestor.evaluar(herramientaRiesgosa, {
        comando: 'rm archivo.txt',
      })

      expect(ev.efecto).toBe('consultar')
      expect(ev.obligatoria).toBe(true)
    })

    it('Una regla denegar impide sin preguntar', async () => {
      const gestor = new GestorPermisos({
        reglasGlobales: [
          { accion: 'read', recurso: '.env', efecto: 'denegar' },
        ],
        manejadorAprobacion: async () => {
          throw new Error('no debería preguntar')
        },
      })

      const registro = new RegistroHerramientas()
      let ejecutado = false
      registro.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'read',
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        motivoAprobacionObligatoria: () => 'archivo protegido',
        ejecutar: async () => {
          ejecutado = true
          return 'secreto'
        },
      })

      const res = await despacharHerramienta(
        'read',
        { ruta: '.env' },
        registro,
        { portero: gestor },
      )

      expect(ejecutado).toBe(false)
      expect(res.esError).toBe(true)
      expect(res.resultado).toContain('Permiso denegado')
    })

    it('El motivo se muestra', () => {
      const gestor = new GestorPermisos({})
      const ev = gestor.evaluar(herramientaRiesgosa, {
        comando: 'rm archivo.txt',
      })

      expect(ev.motivo).toBe('El comando pertenece a la lista negra.')
    })

    it('Sin terminal no se ejecuta lo obligatorio', async () => {
      let ejecutado = false
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
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        motivoAprobacionObligatoria: () => 'archivo protegido',
        ejecutar: async () => {
          ejecutado = true
          return 'secreto'
        },
      })

      const gestor = new GestorPermisos({ esInteractivo: false })
      const res = await despacharHerramienta(
        'read',
        { ruta: '.env' },
        registro,
        { portero: gestor },
      )

      expect(ejecutado).toBe(false)
      expect(res.esError).toBe(true)
      expect(res.resultado).toContain('archivo protegido')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Sin cliente interactivo la aprobación se deniega
  // --------------------------------------------------------------------------
  describe('Requirement: Sin cliente interactivo la aprobación se deniega', () => {
    it('Sin terminal no se ejecuta lo que requiere aprobación', async () => {
      let ejecutado = false
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
        obtenerRecurso: (args) => String(args.ruta ?? ''),
        ejecutar: async () => {
          ejecutado = true
          return 'secreto'
        },
      })

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'c1', nombre: 'read', argumentos: { ruta: '.env' } },
            ],
          },
          { fragmentosTexto: ['No pude leer .env sin terminal'] },
        ],
      })

      const sesion = new SesionInteractiva({
        proveedor,
        registro,
        esInteractivo: false,
      })

      await sesion.enviarMensaje('leé .env')

      expect(ejecutado).toBe(false)
      const turno = sesion.obtenerUltimoTurno()
      const msgTool = turno?.mensajes.find((m) => m.rol === 'tool')
      expect(msgTool?.resultado).toContain('ERROR')
      expect(msgTool?.resultado).toContain('read')
      expect(msgTool?.resultado).toContain('.env')
    })
  })
})
