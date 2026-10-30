import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import {
  RenderizadorLineaALinea,
  RenderizadorProgreso,
} from '../../src/interface/plain.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

describe('instructions Specification Tests (260 + 280)', () => {
  const dirs: string[] = []

  function crearDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-nested-instr-'))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  describe('Requirement: El sistema carga instrucciones anidadas al explorar subdirectorios', () => {
    it('No se buscan al arrancar', () => {
      // WHEN la sesión arranca en un proyecto con packages/web/AGENTS.md
      const dir = crearDir()
      writeFileSync(join(dir, 'AGENTS.md'), '# RAIZ')
      mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'web', 'AGENTS.md'), '# WEB ANIDADO')

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['ok'] }],
      })
      const h = construirHarness({ directorioProyecto: dir, proveedor })

      // THEN solo se lee el AGENTS.md de la raíz
      const prompt = h.sesion.obtenerEstado().promptSistema
      expect(prompt).toContain('# RAIZ')
      expect(prompt).not.toContain('# WEB ANIDADO')
    })

    it('Se cargan al leer un archivo del subdirectorio', async () => {
      // WHEN read lee packages/web/src/App.tsx y existe packages/web/AGENTS.md
      const dir = crearDir()
      writeFileSync(join(dir, 'AGENTS.md'), '# RAIZ')
      mkdirSync(join(dir, 'packages', 'web', 'src'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'web', 'AGENTS.md'), '# WEB ANIDADO')
      writeFileSync(
        join(dir, 'packages', 'web', 'src', 'App.tsx'),
        'export const App = () => null\n',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'r1',
                nombre: 'read',
                argumentos: { ruta: 'packages/web/src/App.tsx' },
              },
            ],
          },
          { fragmentosTexto: ['Listo'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Lee App.tsx')

      // THEN packages/web/AGENTS.md se incorpora al prompt a partir del paso siguiente
      const sistemaEnPaso2 = proveedor.peticionesRecibidas[1]?.sistema ?? ''
      expect(sistemaEnPaso2).toContain('# RAIZ')
      expect(sistemaEnPaso2).toContain('# WEB ANIDADO')
    })

    it('Se cargan con glob con prefijo de directorio', async () => {
      // WHEN glob corre sobre packages/web/**/*.ts
      const dir = crearDir()
      mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
      writeFileSync(
        join(dir, 'packages', 'web', 'AGENTS.md'),
        '# REGLA GLOB WEB',
      )
      writeFileSync(join(dir, 'packages', 'web', 'index.ts'), 'export {}\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'g1',
                nombre: 'glob',
                argumentos: { patron: 'packages/web/**/*.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Encontrado'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Busca archivos ts en web')

      // THEN se buscan instrucciones desde packages/web hacia la raíz
      const sistemaEnPaso2 = proveedor.peticionesRecibidas[1]?.sistema ?? ''
      expect(sistemaEnPaso2).toContain('# REGLA GLOB WEB')
    })

    it('No se cargan con grep', async () => {
      // WHEN grep encuentra coincidencias en varios subdirectorios
      const dir = crearDir()
      mkdirSync(join(dir, 'packages', 'api'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'api', 'AGENTS.md'), '# SECRETO API')
      writeFileSync(
        join(dir, 'packages', 'api', 'server.ts'),
        'export const tokenBusqueda = 123\n',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'gr1',
                nombre: 'grep',
                argumentos: { patron: 'tokenBusqueda' },
              },
            ],
          },
          { fragmentosTexto: ['Hecho'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Busca tokenBusqueda')

      // THEN no se cargan los AGENTS.md de esos subdirectorios
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain(
        '# SECRETO API',
      )
    })

    it('No se releen en la misma sesión', async () => {
      // WHEN una herramienta vuelve a operar sobre un subdirectorio cuyo AGENTS.md ya fue cargado
      const dir = crearDir()
      mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'web', 'AGENTS.md'), '# WEB UNICO')
      writeFileSync(join(dir, 'packages', 'web', 'a.ts'), 'const a = 1\n')
      writeFileSync(join(dir, 'packages', 'web', 'b.ts'), 'const b = 2\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'r1',
                nombre: 'read',
                argumentos: { ruta: 'packages/web/a.ts' },
              },
            ],
          },
          {
            llamadasHerramienta: [
              {
                id: 'r2',
                nombre: 'read',
                argumentos: { ruta: 'packages/web/b.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Fin'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Lee a y b')

      // THEN el archivo no se vuelve a leer ni se duplica en el prompt
      const avisosCarga = h.sesion
        .obtenerEstado()
        .historial.filter(
          (e) =>
            e.tipo === 'aviso' &&
            e.texto.includes('Instrucciones cargadas: packages/web/AGENTS.md'),
        )
      expect(avisosCarga).toHaveLength(1)
      const prompt = h.sesion.obtenerEstado().promptSistema
      expect(prompt.split('# WEB UNICO').length - 1).toBe(1)
    })
  })

  describe('Requirement: Las instrucciones más cercanas al archivo van después de las generales', () => {
    it('Tres niveles de instrucciones', async () => {
      // WHEN existen AGENTS.md, packages/AGENTS.md y packages/web/AGENTS.md y se lee un archivo en packages/web
      const dir = crearDir()
      writeFileSync(join(dir, 'AGENTS.md'), '# NIVEL_0_RAIZ')
      mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'AGENTS.md'), '# NIVEL_1_PACKAGES')
      writeFileSync(join(dir, 'packages', 'web', 'AGENTS.md'), '# NIVEL_2_WEB')
      writeFileSync(join(dir, 'packages', 'web', 'index.ts'), 'export {}\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'r1',
                nombre: 'read',
                argumentos: { ruta: 'packages/web/index.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Ok'] },
        ],
      })

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        promptSistema: 'PROMPT_BASE',
        agentes: [
          {
            nombre: 'build',
            descripcion: 'build',
            modo: 'primario',
            herramientas: ['read'],
            prompt: 'PROMPT_AGENTE',
          },
        ],
      })
      await h.sesion.enviarMensaje('Lee index.ts')

      // THEN el prompt los incluye en ese orden y todos quedan antes del prompt del agente
      const prompt = h.sesion.obtenerEstado().promptSistema
      const idxBase = prompt.indexOf('PROMPT_BASE')
      const idx0 = prompt.indexOf('# NIVEL_0_RAIZ')
      const idx1 = prompt.indexOf('# NIVEL_1_PACKAGES')
      const idx2 = prompt.indexOf('# NIVEL_2_WEB')
      const idxAgente = prompt.indexOf('PROMPT_AGENTE')

      expect(idxBase).toBeGreaterThanOrEqual(0)
      expect(idx0).toBeGreaterThan(idxBase)
      expect(idx1).toBeGreaterThan(idx0)
      expect(idx2).toBeGreaterThan(idx1)
      expect(idxAgente).toBeGreaterThan(idx2)
    })
  })

  describe('Requirement: El tope total de instrucciones evita agotar el presupuesto', () => {
    it('Se supera el tope total a mitad de turno', async () => {
      // WHEN cargar un AGENTS.md anidado haría que la suma supere el tope total
      const dir = crearDir()
      writeFileSync(join(dir, 'AGENTS.md'), 'R'.repeat(500))
      mkdirSync(join(dir, 'sub'), { recursive: true })
      writeFileSync(join(dir, 'sub', 'AGENTS.md'), 'S'.repeat(600))
      writeFileSync(join(dir, 'sub', 'archivo.ts'), 'export const x = 1\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'r1',
                nombre: 'read',
                argumentos: { ruta: 'sub/archivo.ts' },
              },
            ],
          },
          { fragmentosTexto: ['Continuó sin romperse'] },
        ],
      })

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        topeInstruccionesBytes: 1000,
        topeTotalInstruccionesBytes: 800,
      })
      await h.sesion.enviarMensaje('Lee sub/archivo.ts')

      // THEN ese archivo no se incorpora, se informa como texto y el turno continúa
      expect(h.sesion.obtenerUltimoTurno()?.tipo).toBe('completado')
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain(
        'S'.repeat(50),
      )
      const toolElem = h.sesion
        .obtenerEstado()
        .historial.find((e) => e.tipo === 'herramienta')
      expect(toolElem?.tipo === 'herramienta' && toolElem.resultado).toContain(
        'supera el tope total de instrucciones',
      )
    })
  })

  describe('Requirement: El sistema informa qué instrucciones se cargaron y los subagentes las heredan', () => {
    it('Se informa al cargar una instrucción anidada en modo plano y TUI', async () => {
      // WHEN se incorpora un AGENTS.md anidado durante el turno
      const dir = crearDir()
      mkdirSync(join(dir, 'packages', 'ui'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'ui', 'AGENTS.md'), '# UI RULES')
      writeFileSync(join(dir, 'packages', 'ui', 'Button.tsx'), 'export {}\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'r1',
                nombre: 'read',
                argumentos: { ruta: 'packages/ui/Button.tsx' },
              },
            ],
          },
          { fragmentosTexto: ['Hecho'] },
        ],
      })

      const lineasPlanas: string[] = []
      const renderPlano = new RenderizadorLineaALinea((l) =>
        lineasPlanas.push(l),
      )
      const progreso = new RenderizadorProgreso(renderPlano)

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        alActualizar: (estado) => progreso.actualizar(estado),
      })
      await h.sesion.enviarMensaje('Lee Button.tsx')

      // THEN la interfaz muestra la ruta del archivo cargado
      expect(
        lineasPlanas.some((l) =>
          l.includes('Instrucciones cargadas: packages/ui/AGENTS.md'),
        ),
      ).toBe(true)
    })

    it('El subagente recibe las instrucciones ya cargadas y no carga las suyas', async () => {
      // WHEN el padre ya cargó packages/web/AGENTS.md y delega una tarea a un subagente que lee en otro subdirectorio
      const dir = crearDir()
      writeFileSync(join(dir, 'AGENTS.md'), '# RAIZ_PADRE')
      mkdirSync(join(dir, 'packages', 'web'), { recursive: true })
      writeFileSync(join(dir, 'packages', 'web', 'AGENTS.md'), '# WEB_PADRE')
      writeFileSync(join(dir, 'packages', 'web', 'main.ts'), 'export {}\n')

      mkdirSync(join(dir, 'packages', 'secret'), { recursive: true })
      writeFileSync(
        join(dir, 'packages', 'secret', 'AGENTS.md'),
        '# NO_CARGAR_EN_HIJO',
      )
      writeFileSync(join(dir, 'packages', 'secret', 'data.ts'), 'export {}\n')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          // Paso 1 padre: lee packages/web/main.ts -> carga WEB_PADRE
          {
            llamadasHerramienta: [
              {
                id: 'p1',
                nombre: 'read',
                argumentos: { ruta: 'packages/web/main.ts' },
              },
            ],
          },
          // Paso 2 padre: delega a explore
          {
            llamadasHerramienta: [
              {
                id: 'p2',
                nombre: 'task',
                argumentos: {
                  agent: 'explore',
                  prompt: 'Investiga packages/secret/data.ts',
                },
              },
            ],
          },
          // Paso 1 hijo (explore): lee packages/secret/data.ts
          {
            llamadasHerramienta: [
              {
                id: 'h1',
                nombre: 'read',
                argumentos: { ruta: 'packages/secret/data.ts' },
              },
            ],
          },
          // Paso 2 hijo (explore): responde
          { fragmentosTexto: ['Resultado del hijo'] },
          // Paso 3 padre: responde
          { fragmentosTexto: ['Respuesta final del padre'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Ejecuta flujo padre e hijo')

      // El hijo (llamadas 3 y 4 al proveedor) recibió # RAIZ_PADRE y # WEB_PADRE, pero nunca # NO_CARGAR_EN_HIJO
      const sistemasRecibidos = proveedor.peticionesRecibidas.map(
        (p) => p.sistema ?? '',
      )
      expect(sistemasRecibidos[2]).toContain('# RAIZ_PADRE')
      expect(sistemasRecibidos[2]).toContain('# WEB_PADRE')
      expect(sistemasRecibidos[3]).toContain('# WEB_PADRE')
      expect(sistemasRecibidos[3]).not.toContain('# NO_CARGAR_EN_HIJO')
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain(
        '# NO_CARGAR_EN_HIJO',
      )
    })
  })
})
