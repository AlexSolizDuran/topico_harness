import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import {
  ENCABEZADO_MEMORIA,
  ENCABEZADO_PREFERENCIAS_USUARIO,
} from '../../src/memory/index.js'
import type { ConfiguracionHarness } from '../../src/provider/config.js'
import { ProveedorSimulado } from '../../src/provider/index.js'

describe('Integración de memoria', () => {
  const dirs: string[] = []

  function crearProyecto(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-memoria-integracion-'))
    dirs.push(dir)
    return dir
  }

  function configuracion(extra: Partial<ConfiguracionHarness> = {}) {
    return {
      proveedores: {
        local: {
          tipo: 'openai-compatible',
          baseUrl: 'http://localhost:11434/v1',
          modelos: [{ id: 'modelo' }],
        },
      },
      ...extra,
    }
  }

  function escribirMemoria(
    dir: string,
    indice: string,
    detalles: Record<string, string> = {},
  ): void {
    const ruta = join(dir, '.harness', 'memory')
    mkdirSync(ruta, { recursive: true })
    writeFileSync(join(ruta, 'index.md'), indice, 'utf-8')
    for (const [id, contenido] of Object.entries(detalles)) {
      writeFileSync(join(ruta, `${id}.md`), contenido, 'utf-8')
    }
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('inyecta el índice con su marcador y la ruta del detalle sin cargar el detalle', async () => {
    const dir = crearProyecto()
    escribirMemoria(
      dir,
      '- [conv] Los scripts internos usan ESM (2026-01-01 | origen: sesion_previa)\n',
      { conv: 'Detalle extenso que no debe viajar en el prompt inicial.' },
    )
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion({ memoria: {} }),
      esInteractivo: false,
      guardarSesiones: false,
    })

    const prompt = harness.sesion.obtenerEstado().promptSistema ?? ''
    expect(prompt).toContain(ENCABEZADO_MEMORIA)
    expect(prompt).toContain('Los scripts internos usan ESM')
    expect(prompt).toContain('origen: sesion_previa')
    expect(prompt).toContain('[detalle: .harness/memory/conv.md]')
    expect(prompt).not.toContain('Detalle extenso que no debe viajar')

    const metricas = harness.sesion.obtenerMetricasContexto()
    expect(metricas.tokensSistema).toBeGreaterThan(0)

    const lectura = await harness.registro
      .obtener('read')
      ?.ejecutar({ ruta: '.harness/memory/conv.md' })
    expect(lectura).toContain('Detalle extenso que no debe viajar')

    await harness.cerrar()
  })

  it('lee además la memoria de usuario cuando está habilitada y las mantiene separadas', async () => {
    const dir = crearProyecto()
    const dirUsuario = crearProyecto()
    escribirMemoria(dir, '- [proyecto] El proyecto usa Node 24\n')
    escribirMemoria(dirUsuario, '- [usuario] Prefiero respuestas breves\n')

    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion({
        memoria: {
          usuario: true,
          rutaUsuario: join(dirUsuario, '.harness', 'memory'),
        },
      }),
      esInteractivo: false,
      guardarSesiones: false,
    })

    const prompt = harness.sesion.obtenerEstado().promptSistema ?? ''
    expect(prompt).toContain(ENCABEZADO_MEMORIA)
    expect(prompt).toContain(ENCABEZADO_PREFERENCIAS_USUARIO)
    expect(prompt).toContain('El proyecto usa Node 24')
    expect(prompt).toContain('Prefiero respuestas breves')

    await harness.cerrar()
  })

  it('un proyecto sin memoria arranca igual y no informa un error', async () => {
    const dir = crearProyecto()
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion(),
      esInteractivo: false,
      guardarSesiones: false,
    })

    expect(harness.sesion.obtenerEstado().promptSistema).not.toContain(
      ENCABEZADO_MEMORIA,
    )
    await harness.cerrar()
  })

  it('el bloque de memoria cuenta en el presupuesto y un exceso avisa sin truncarlo', async () => {
    const dir = crearProyecto()
    const titulo = `Hecho largo ${'X'.repeat(4000)}`
    escribirMemoria(dir, `- [largo] ${titulo}\n`)

    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [{ fragmentosTexto: ['ok'] }],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion({ memoria: {} }),
      ventanaContexto: 1000,
      esInteractivo: false,
      guardarSesiones: false,
    })

    await harness.sesion.enviarMensaje('hola')

    const avisos = harness.sesion
      .obtenerEstado()
      .historial.filter((entrada) => entrada.tipo === 'aviso')
      .map((entrada) => entrada.texto)
    expect(avisos.some((texto) => texto.includes('presupuesto'))).toBe(true)
    expect(harness.sesion.obtenerEstado().promptSistema).toContain(titulo)

    await harness.cerrar()
  })

  it('extrae hechos no deducibles al cerrar y los guarda junto al índice', async () => {
    const dir = crearProyecto()
    escribirMemoria(dir, '- [previo] La base se llama harness\n')
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [
        { fragmentosTexto: ['ok'] },
        {
          fragmentosTexto: [
            '- convención: los scripts internos se ejecutan con tsx\n',
          ],
        },
      ],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion({ memoria: {} }),
      esInteractivo: false,
      guardarSesiones: false,
    })

    await harness.sesion.enviarMensaje('hola')
    await harness.cerrar()

    const indice = readFileSync(
      join(dir, '.harness', 'memory', 'index.md'),
      'utf-8',
    )
    expect(indice).toContain('La base se llama harness')
    expect(indice).toContain('los scripts internos se ejecutan con tsx')
    expect(harness.sesion.obtenerHistorial().length).toBeGreaterThan(0)
  })

  it('un fallo de extracción se informa como aviso y no impide cerrar', async () => {
    const dir = crearProyecto()
    escribirMemoria(dir, '- [previo] Dato previo\n')
    const proveedor = new ProveedorSimulado({
      nombre: 'local',
      respuestas: [
        { fragmentosTexto: ['ok'] },
        {
          fallo: {
            codigoEstado: 500,
            mensaje: 'Error de servidor de IA',
            esTransitorio: false,
          },
        },
      ],
    })
    const harness = construirHarness({
      directorioProyecto: dir,
      proveedor,
      config: configuracion({ memoria: {} }),
      esInteractivo: false,
      guardarSesiones: false,
    })

    await harness.sesion.enviarMensaje('hola')
    await expect(harness.cerrar()).resolves.toBeUndefined()

    const avisos = harness.sesion
      .obtenerEstado()
      .historial.filter((entrada) => entrada.tipo === 'aviso')
      .map((entrada) => entrada.texto)
    expect(avisos.some((texto) => texto.includes('No se pudo extraer'))).toBe(
      true,
    )
    expect(existsSync(join(dir, '.harness', 'memory', 'index.md'))).toBe(true)
  })
})
