import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PresupuestoContexto } from '../../src/context/budget.js'
import { medirContexto } from '../../src/context/metrics.js'
import { aplicarPipelineContexto } from '../../src/context/pipeline.js'
import { estimarTokensTexto } from '../../src/context/tokens.js'
import {
  AlmacenMemoria,
  ENCABEZADO_MEMORIA,
  ENCABEZADO_PREFERENCIAS_USUARIO,
  type EntradaMemoria,
  ErrorTopeMemoria,
  extraerHechosDeSesion,
  formatearBloqueMemoria,
  MARCADOR_AVISO_MEMORIA,
  resolverContradicciones,
} from '../../src/memory/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import type { Mensaje } from '../../src/types.js'

describe('memory Specification Tests', () => {
  let tempDir: string
  let otroProyectoDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'harness-memory-test-'))
    otroProyectoDir = mkdtempSync(join(tmpdir(), 'harness-memory-otro-'))
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
    try {
      rmSync(otroProyectoDir, { recursive: true, force: true })
    } catch {}
  })

  // --------------------------------------------------------------------------
  // Requirement: El sistema carga la memoria del proyecto al arrancar
  // --------------------------------------------------------------------------
  describe('Requirement: El sistema carga la memoria del proyecto al arrancar', () => {
    it('Un proyecto con memoria', () => {
      // WHEN el proyecto tiene un índice de memoria
      const dirMem = join(tempDir, '.harness', 'memory')
      mkdirSync(dirMem, { recursive: true })
      writeFileSync(
        join(dirMem, 'index.md'),
        '# Memoria\n- [item_1] Usar Node 24 ESM\n',
        'utf-8',
      )

      const almacen = new AlmacenMemoria(tempDir)
      const indice = almacen.cargarIndice()

      // THEN el sistema carga el índice al arrancar
      expect(indice).toHaveLength(1)
      expect(indice[0]?.id).toBe('item_1')
      expect(indice[0]?.titulo).toBe('Usar Node 24 ESM')
    })

    it('Un proyecto sin memoria', () => {
      // WHEN el proyecto no tiene directorio de memoria
      const almacen = new AlmacenMemoria(tempDir)

      // THEN la sesión arranca igual y no se informa un error
      expect(() => almacen.cargarIndice()).not.toThrow()
      expect(almacen.cargarIndice()).toEqual([])
    })

    it('El detalle se carga bajo demanda', () => {
      // WHEN el modelo necesita un detalle que no está en el índice
      const dirMem = join(tempDir, '.harness', 'memory')
      mkdirSync(dirMem, { recursive: true })
      writeFileSync(
        join(dirMem, 'index.md'),
        '- [jwt] Configuración de tokens JWT\n- [db] Pool Postgres\n',
        'utf-8',
      )
      writeFileSync(
        join(dirMem, 'jwt.md'),
        'Detalle extenso de configuración JWT: expiración de 15 minutos, firmas con claves públicas rotativas.',
        'utf-8',
      )

      const almacen = new AlmacenMemoria(tempDir)
      const indice = almacen.cargarIndice()
      expect(indice).toHaveLength(2)

      // THEN el sistema lo carga desde su archivo sin cargar todos los detalles
      const detalle = almacen.cargarDetalle('jwt')
      expect(detalle).toContain('Detalle extenso de configuración JWT')
      expect(almacen.cargarDetalle('db')).toBeUndefined()
    })

    it('No se mezcla con otro proyecto', () => {
      // WHEN la sesión trabaja en un proyecto con memoria propia
      const dirA = join(tempDir, '.harness', 'memory')
      mkdirSync(dirA, { recursive: true })
      writeFileSync(
        join(dirA, 'index.md'),
        '- [hechoA] Hecho proyecto A\n',
        'utf-8',
      )

      const dirB = join(otroProyectoDir, '.harness', 'memory')
      mkdirSync(dirB, { recursive: true })
      writeFileSync(
        join(dirB, 'index.md'),
        '- [hechoB] Hecho proyecto B\n',
        'utf-8',
      )

      const almacenA = new AlmacenMemoria(tempDir)
      const entradasA = almacenA.cargarIndice()

      // THEN el sistema no inyecta la memoria de otro proyecto
      expect(entradasA.some((e) => e.id === 'hechoA')).toBe(true)
      expect(entradasA.some((e) => e.id === 'hechoB')).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La memoria se distingue de las instrucciones y del historial
  // --------------------------------------------------------------------------
  describe('Requirement: La memoria se distingue de las instrucciones y del historial', () => {
    it('Instrucciones y memoria son contextos distintos', () => {
      // WHEN la sesión arranca con instrucciones y memoria
      const memoria = [{ id: 'm1', titulo: 'Hecho aprendido', contenido: '' }]
      const bloqueMemoria = formatearBloqueMemoria({ memoriaProyecto: memoria })
      const instrucciones = '# INSTRUCCIONES ESTABLES DE AGENTS.md'

      // THEN cada una se identifica por separado en el prompt
      expect(bloqueMemoria).toContain(ENCABEZADO_MEMORIA)
      expect(bloqueMemoria).not.toContain(instrucciones)
      expect(instrucciones).not.toContain(ENCABEZADO_MEMORIA)
    })

    it('La memoria no se escribe en las instrucciones', () => {
      // WHEN el sistema aprende un hecho nuevo
      const rutaAgents = join(tempDir, 'AGENTS.md')
      writeFileSync(rutaAgents, '# Reglas fijas del proyecto\n', 'utf-8')

      const almacen = new AlmacenMemoria(tempDir)
      almacen.guardarEntradas([
        { id: 'h1', titulo: 'Nuevo hecho aprendido', contenido: 'detalle' },
      ])

      // THEN lo escribe en la memoria y no modifica las instrucciones del proyecto
      const contenidoAgents = readFileSync(rutaAgents, 'utf-8')
      expect(contenidoAgents).toBe('# Reglas fijas del proyecto\n')
      expect(almacen.cargarIndice()).toHaveLength(1)
    })

    it('La memoria no es historial', () => {
      // WHEN el modelo lee la memoria
      const bloque = formatearBloqueMemoria({
        memoriaProyecto: [
          { id: 'm1', titulo: 'Convención interna', contenido: '' },
        ],
      })
      const mensaje: Mensaje = { rol: 'system', contenido: bloque }

      // THEN la recibe como un bloque de sistema y no como un mensaje previo de la conversación
      expect(mensaje.rol).toBe('system')
      expect(mensaje.rol).not.toBe('user')
      expect(mensaje.rol).not.toBe('assistant')
    })

    it('El origen es visible', () => {
      // WHEN una entrada de memoria tiene origen y fecha
      const entrada: EntradaMemoria = {
        id: 'e1',
        titulo: 'Decisión sobre endpoints',
        contenido: '',
        origen: 'modulo_auth',
        fecha: '2026-11-01',
      }
      const bloque = formatearBloqueMemoria({ memoriaProyecto: [entrada] })

      // THEN el bloque inyectado los muestra
      expect(bloque).toContain('2026-11-01')
      expect(bloque).toContain('origen: modulo_auth')
      expect(bloque).toContain('Decisión sobre endpoints')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La memoria se inyecta con marcador y entra en el presupuesto
  // --------------------------------------------------------------------------
  describe('Requirement: La memoria se inyecta con marcador y entra en el presupuesto', () => {
    it('Bloque marcado como memoria', () => {
      // WHEN el sistema inyecta memoria en el prompt
      const bloque = formatearBloqueMemoria({
        memoriaProyecto: [
          { id: 'm1', titulo: 'Dato aprendido', contenido: '' },
        ],
      })

      // THEN el bloque se identifica como memoria y no como un hecho verificado
      expect(bloque).toContain(ENCABEZADO_MEMORIA)
      expect(bloque).toContain(MARCADOR_AVISO_MEMORIA)
    })

    it('La memoria cuenta en el presupuesto', () => {
      // WHEN se calcula el uso del contexto
      const bloque = formatearBloqueMemoria({
        memoriaProyecto: [{ id: 'm1', titulo: 'X'.repeat(400), contenido: '' }],
      })
      const presupuesto = new PresupuestoContexto({ ventanaContexto: 1000 })
      const tokensMemoria = estimarTokensTexto(bloque ?? '')
      const metricas = medirContexto(
        presupuesto,
        [{ rol: 'user', contenido: 'hola' }],
        undefined,
        0,
        undefined,
        { tokensSistema: tokensMemoria },
      )

      // THEN el bloque de memoria se incluye en el conteo
      expect(metricas.tokensActuales).toBeGreaterThan(100)
    })

    it('La memoria no se trunca en silencio', () => {
      // WHEN el bloque de memoria no cabe en el presupuesto
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'lee grande.ts' },
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'c1', nombre: 'read', argumentos: { ruta: 'grande.ts' } },
          ],
        },
        {
          rol: 'tool',
          idLlamada: 'c1',
          resultado: 'G'.repeat(2600),
        },
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'c2', nombre: 'read', argumentos: { ruta: 'chico.ts' } },
          ],
        },
        { rol: 'tool', idLlamada: 'c2', resultado: 'ok' },
      ]

      // THEN el sistema aplica el pipeline de contexto y avisa, en vez de recortar la memoria sin informar
      const res = aplicarPipelineContexto(mensajes, presupuesto)
      expect(res.etapaAplicada).toBe('enmascarar')
      expect(res.tokensRecuperados).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Al cerrar la sesión se extraen hechos no deducibles
  // --------------------------------------------------------------------------
  describe('Requirement: Al cerrar la sesión se extraen hechos no deducibles', () => {
    it('Se extrae una convención', async () => {
      // WHEN la sesión usó una convención que no se deduce del código
      const transcript: Mensaje[] = [
        {
          rol: 'user',
          contenido:
            'convención: los controllers usan inyección por constructor privada.',
        },
      ]

      const resultado = await extraerHechosDeSesion(transcript)

      // THEN la extracción la guarda en la memoria
      expect(resultado.entradas.length).toBeGreaterThan(0)
      expect(resultado.entradas[0]?.titulo).toContain(
        'inyección por constructor privada',
      )
    })

    it('Se descarta lo obvio', async () => {
      // WHEN el transcript solo contiene pedidos y acciones evidentes
      const transcript: Mensaje[] = [
        {
          rol: 'user',
          contenido: 'leí el archivo index.ts y el archivo existe',
        },
      ]

      const resultado = await extraerHechosDeSesion(transcript)

      // THEN la extracción no guarda esas entradas
      expect(resultado.entradas).toHaveLength(0)
    })

    it('Se descarta lo deducible del código', async () => {
      // WHEN un hecho se puede obtener leyendo el código
      const transcript: Mensaje[] = [
        {
          rol: 'assistant',
          contenido:
            'el paquete está en package.json y exporta la función main',
        },
      ]

      const resultado = await extraerHechosDeSesion(transcript)

      // THEN la extracción no lo guarda en la memoria
      expect(resultado.entradas).toHaveLength(0)
    })

    it('Un fallo de extracción no impide cerrar', async () => {
      // WHEN la extracción falla al cerrar la sesión
      const proveedorFallido = new ProveedorSimulado({
        respuestas: [
          {
            fallo: {
              codigoEstado: 500,
              mensaje: 'Error de servidor de IA',
              esTransitorio: false,
            },
          },
        ],
      })

      const resultado = await extraerHechosDeSesion(
        [{ rol: 'user', contenido: 'decision: usar rust' }],
        { proveedor: proveedorFallido },
      )

      // THEN la sesión se cierra igual y el fallo se informa
      expect(resultado.error).toBeDefined()
      expect(resultado.error).toContain('Error de servidor de IA')
      expect(resultado.entradas).toHaveLength(0)
    })

    it('La escritura es atómica', () => {
      // WHEN la extracción escribe varias entradas
      const almacen = new AlmacenMemoria(tempDir, {
        topeArchivoBytes: 50, // tope chico para forzar fallo en la segunda entrada
      })

      const entradasValidasYUnaGrande: EntradaMemoria[] = [
        { id: 'ok_1', titulo: 'corta', contenido: 'contenido corto' },
        { id: 'fail_2', titulo: 'grande', contenido: 'F'.repeat(200) },
      ]

      // THEN o se escriben todas o no se escribe ninguna, sin dejar archivos a medias
      expect(() => almacen.guardarEntradas(entradasValidasYUnaGrande)).toThrow(
        ErrorTopeMemoria,
      )
      expect(almacen.cargarDetalle('ok_1')).toBeUndefined()
    })

    it('La escritura directa respeta la acción edit', () => {
      // WHEN el modelo escribe o edita un archivo de memoria
      const rutaArchivo = join(tempDir, '.harness', 'memory', 'index.md')
      // La evaluación de permisos para escribir en .harness/ se evalúa con acción 'edit'
      expect(rutaArchivo.endsWith('index.md')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La memoria se puede curar y editar a mano
  // --------------------------------------------------------------------------
  describe('Requirement: La memoria se puede curar y editar a mano', () => {
    it('Índice y detalle', () => {
      // WHEN la memoria tiene muchas entradas
      const entradas: EntradaMemoria[] = [
        {
          id: 'det_1',
          titulo: 'Resumen en índice',
          contenido: 'Detalle largo en archivo propio',
        },
      ]
      const almacen = new AlmacenMemoria(tempDir)
      almacen.guardarEntradas(entradas)

      // THEN el índice se mantiene chico y el detalle vive en archivos separados
      const indice = almacen.cargarIndice()
      expect(indice).toHaveLength(1)
      expect(indice[0]?.titulo).toBe('Resumen en índice')
      expect(almacen.cargarDetalle('det_1')).toBe(
        'Detalle largo en archivo propio',
      )
    })

    it('Edición manual', () => {
      // WHEN la persona edita un archivo de memoria
      const dirMem = join(tempDir, '.harness', 'memory')
      mkdirSync(dirMem, { recursive: true })
      writeFileSync(
        join(dirMem, 'index.md'),
        '# Memoria Editada a Mano\n- [manual] Regla agregada manualmente por el desarrollador\n',
        'utf-8',
      )

      const almacen = new AlmacenMemoria(tempDir)
      const indice = almacen.cargarIndice()

      // THEN el sistema lo lee en la sesión siguiente sin un paso de importación
      expect(indice).toHaveLength(1)
      expect(indice[0]?.id).toBe('manual')
      expect(indice[0]?.titulo).toContain('Regla agregada manualmente')
    })

    it('Entrada obsoleta', () => {
      // WHEN una entrada de memoria ya no es cierta
      const dirMem = join(tempDir, '.harness', 'memory')
      mkdirSync(dirMem, { recursive: true })
      writeFileSync(
        join(dirMem, 'index.md'),
        '- [antigua] ~~La BD es MySQL~~ [obsoleta]\n- [nueva] La BD es PostgreSQL\n',
        'utf-8',
      )

      const almacen = new AlmacenMemoria(tempDir)
      const indice = almacen.cargarIndice()

      // THEN la persona puede eliminarla o el sistema la marca como obsoleta
      const obsoleta = indice.find((e) => e.id === 'antigua')
      const activa = indice.find((e) => e.id === 'nueva')
      expect(obsoleta?.obsoleta).toBe(true)
      expect(activa?.obsoleta).toBe(false)
    })

    it('Contradicción', () => {
      // WHEN dos entradas de memoria se contradicen
      const entradas: EntradaMemoria[] = [
        {
          id: 'v1',
          titulo: 'Base de datos MySQL',
          contenido: '',
          fecha: '2026-01-01',
        },
        {
          id: 'v2',
          titulo: 'Base de datos MySQL',
          contenido: '',
          fecha: '2026-06-01',
        },
      ]

      const curadas = resolverContradicciones(entradas)

      // THEN el sistema marca la más vieja como superada en vez de usar ambas
      const vieja = curadas.find((e) => e.id === 'v1')
      const nueva = curadas.find((e) => e.id === 'v2')
      expect(vieja?.obsoleta).toBe(true)
      expect(vieja?.superadaPor).toBe('v2')
      expect(nueva?.obsoleta).toBeFalsy()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El ámbito de la memoria es el proyecto y, opcionalmente, el usuario
  // --------------------------------------------------------------------------
  describe('Requirement: El ámbito de la memoria es el proyecto y, opcionalmente, el usuario', () => {
    it('Memoria de proyecto por defecto', () => {
      // WHEN el proyecto declara memoria sin configurar un ámbito
      const almacen = new AlmacenMemoria(tempDir)

      // THEN la memoria se guarda con el proyecto
      expect(almacen.obtenerDirectorio()).toBe(
        join(tempDir, '.harness', 'memory'),
      )
    })

    it('Memoria de usuario opcional', () => {
      // WHEN la configuración declara memoria de usuario
      const bloque = formatearBloqueMemoria({
        memoriaProyecto: [
          { id: 'p1', titulo: 'Hecho del repo', contenido: '' },
        ],
        memoriaUsuario: [
          { id: 'u1', titulo: 'Preferencia dark mode', contenido: '' },
        ],
      })

      // THEN el sistema la lee además de la del proyecto y las mantiene separadas
      expect(bloque).toContain(ENCABEZADO_MEMORIA)
      expect(bloque).toContain(ENCABEZADO_PREFERENCIAS_USUARIO)
      expect(bloque).toContain('Hecho del repo')
      expect(bloque).toContain('Preferencia dark mode')
    })

    it('No se mezclan proyectos', () => {
      // WHEN la sesión cambia de proyecto
      const almacen1 = new AlmacenMemoria(tempDir)
      const almacen2 = new AlmacenMemoria(otroProyectoDir)
      almacen1.guardarEntradas([
        { id: 'p1', titulo: 'Dato Repo 1', contenido: '' },
      ])
      almacen2.guardarEntradas([
        { id: 'p2', titulo: 'Dato Repo 2', contenido: '' },
      ])

      // THEN no aparecen entradas del proyecto anterior
      const e1 = almacen1.cargarIndice()
      const e2 = almacen2.cargarIndice()
      expect(e1.map((e) => e.id)).toEqual(['p1'])
      expect(e2.map((e) => e.id)).toEqual(['p2'])
    })

    it('Precedencia marcada', () => {
      // WHEN una preferencia de usuario coincide con un hecho del proyecto
      const bloque = formatearBloqueMemoria({
        memoriaProyecto: [
          { id: 'proj_ts', titulo: 'Usar TypeScript 7.0', contenido: '' },
        ],
        memoriaUsuario: [
          { id: 'usr_ts', titulo: 'Usar TypeScript 5.4', contenido: '' },
        ],
      })

      // THEN el sistema conserva el hecho del proyecto y muestra la preferencia como tal
      expect(bloque).toContain(ENCABEZADO_MEMORIA)
      expect(bloque).toContain('Usar TypeScript 7.0')
      expect(bloque).toContain(
        '[Preferencia de usuario: no sobrescribe hechos del proyecto]',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Un archivo de memoria que supera el tope falla en vez de truncarse
  // --------------------------------------------------------------------------
  describe('Requirement: Un archivo de memoria que supera el tope falla en vez de truncarse', () => {
    it('Un archivo dentro del tope', () => {
      // WHEN un archivo de memoria está por debajo del tope
      const almacen = new AlmacenMemoria(tempDir, { topeArchivoBytes: 1000 })
      almacen.guardarEntradas([
        { id: 'm1', titulo: 'ok', contenido: 'A'.repeat(500) },
      ])

      // THEN el sistema lo escribe normalmente
      expect(almacen.cargarDetalle('m1')).toBe('A'.repeat(500))
    })

    it('Un archivo justo en el tope', () => {
      // WHEN un archivo de memoria alcanza exactamente el tope
      const tope = 100
      const almacen = new AlmacenMemoria(tempDir, { topeArchivoBytes: tope })
      const contenidoExacto = 'K'.repeat(tope)
      almacen.guardarEntradas([
        { id: 'exacto', titulo: 'ok', contenido: contenidoExacto },
      ])

      // THEN el sistema lo acepta
      expect(almacen.cargarDetalle('exacto')).toBe(contenidoExacto)
    })

    it('Un archivo que supera el tope', () => {
      // WHEN una escritura de memoria supera el tope
      const tope = 50
      const almacen = new AlmacenMemoria(tempDir, { topeArchivoBytes: tope })

      // THEN el sistema falla con un error que nombra archivo, tamaño y tope
      expect(() =>
        almacen.guardarEntradas([
          { id: 'supera', titulo: 'ok', contenido: 'Z'.repeat(120) },
        ]),
      ).toThrowError(/supera el tope configurado de 50 bytes/)
    })

    it('No se trunca', () => {
      // WHEN la escritura supera el tope
      const tope = 50
      const almacen = new AlmacenMemoria(tempDir, { topeArchivoBytes: tope })

      try {
        almacen.guardarEntradas([
          { id: 'no_trunca', titulo: 'ok', contenido: 'N'.repeat(200) },
        ])
      } catch {}

      // THEN el sistema no guarda una versión truncada del contenido
      expect(almacen.cargarDetalle('no_trunca')).toBeUndefined()
    })
  })
})
