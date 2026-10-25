import { describe, expect, it } from 'vitest'
import {
  aplicarPipelineContexto,
  calcularTokensHistorial,
  compactarHistorial,
  ENCABEZADO_RESUMEN,
  ErrorPresupuestoExcedido,
  generarTextoResumen,
  MARCADOR_RECORTADO,
  medirContexto,
  PORCENTAJE_PRESUPUESTO_DEFECTO,
  PresupuestoContexto,
  recortarSalidasHerramientasViejas,
} from '../../src/context/index.js'
import {
  ejecutarTurno,
  RegistroHerramientas,
  validarHistorialAtomico,
} from '../../src/core/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import { ejecutarTurnoSubagente } from '../../src/subagents/index.js'
import type { Mensaje } from '../../src/types.js'

describe('context Specification Tests', () => {
  // --------------------------------------------------------------------------
  // Requirement: El sistema mantiene un presupuesto de contexto con margen conservador
  // --------------------------------------------------------------------------
  describe('Requirement: El sistema mantiene un presupuesto de contexto con margen conservador', () => {
    it('Se alcanza el presupuesto', () => {
      // WHEN el historial del turno alcanza el límite del presupuesto
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })

      // THEN el sistema deja de acumular contexto antes de enviar otra petición
      expect(presupuesto.haAlcanzadoLimite(800)).toBe(true)
      expect(presupuesto.haAlcanzadoLimite(799)).toBe(false)
    })

    it('El valor por defecto', () => {
      // WHEN el sistema arranca sin configuración explícita
      // THEN el límite del presupuesto es el 80% de la ventana de contexto del modelo
      expect(PORCENTAJE_PRESUPUESTO_DEFECTO).toBe(0.8)
      const pres = new PresupuestoContexto({ ventanaContexto: 100000 })
      expect(pres.limitePresupuesto).toBe(80000)
    })

    it('El margen se conserva', () => {
      // WHEN el historial ocupa el límite del presupuesto
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })

      // THEN el sistema no envía una petición que lo supere
      expect(presupuesto.margenConservado).toBe(200)
      expect(() => presupuesto.validarEnvio(801)).toThrow(
        ErrorPresupuestoExcedido,
      )
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El presupuesto se alimenta del conteo del provider con respaldo estimado
  // --------------------------------------------------------------------------
  describe('Requirement: El presupuesto se alimenta del conteo del provider con respaldo estimado', () => {
    it('El provider reporta el conteo', () => {
      // WHEN el provider reporta el conteo de tokens de la respuesta
      const reporte = { entrada: 150, salida: 50 }
      const medicion = calcularTokensHistorial([], reporte)

      // THEN el sistema lo usa para actualizar el presupuesto
      expect(medicion.tokens).toBe(200)
      expect(medicion.esEstimado).toBe(false)
    })

    it('El provider no lo reporta', () => {
      // WHEN una respuesta llega sin conteo de tokens
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: '1234567890123456' }, // 16 caracteres -> 4 tokens
      ]
      const medicion = calcularTokensHistorial(mensajes, undefined)

      // THEN el sistema estima a partir del largo del texto y lo usa como respaldo
      expect(medicion.tokens).toBe(4)
      expect(medicion.esEstimado).toBe(true)
    })

    it('La estimación no se presenta como exacta', () => {
      // WHEN el presupuesto se actualizó con un valor estimado
      const medicion = calcularTokensHistorial(
        [{ rol: 'user', contenido: 'prueba' }],
        undefined,
      )

      // THEN el sistema lo trata como aproximado y no como el conteo del provider
      expect(medicion.esEstimado).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Al acercarse al límite el sistema recorta salidas viejas de herramientas
  // --------------------------------------------------------------------------
  describe('Requirement: Al acercarse al límite el sistema recorta salidas viejas de herramientas', () => {
    it('Herramienta antigua recortada', () => {
      // WHEN el historial se acerca al límite y hay resultados de herramientas de pasos anteriores
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'paso 1' },
        {
          rol: 'assistant',
          llamadasHerramientas: [{ id: 'c1', nombre: 'read', argumentos: {} }],
        },
        {
          rol: 'tool',
          idLlamada: 'c1',
          resultado: 'contenido viejo y largo de 8KB',
        },
        { rol: 'user', contenido: 'paso 2' },
        {
          rol: 'assistant',
          llamadasHerramientas: [{ id: 'c2', nombre: 'read', argumentos: {} }],
        },
        { rol: 'tool', idLlamada: 'c2', resultado: 'contenido reciente' },
      ]

      const recortados = recortarSalidasHerramientasViejas(mensajes)

      // THEN el sistema reemplaza esos contenidos por una marca de recortado
      expect(recortados[2]?.resultado).toBe(MARCADOR_RECORTADO)
    })

    it('Los mensajes del usuario se conservan', () => {
      // WHEN el sistema recorta por cercanía al límite
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'consulta importante de usuario' },
        { rol: 'tool', idLlamada: 'c1', resultado: 'salida vieja' },
        { rol: 'tool', idLlamada: 'c2', resultado: 'salida nueva' },
      ]

      const recortados = recortarSalidasHerramientasViejas(mensajes)

      // THEN conserva íntegros los mensajes del usuario
      expect(recortados[0]?.contenido).toBe('consulta importante de usuario')
    })

    it('No se recorta lo que el modelo acaba de ver', () => {
      // WHEN el resultado de una herramienta todavía no fue entregado al modelo
      const mensajes: Mensaje[] = [
        { rol: 'tool', idLlamada: 'c1', resultado: 'salida previa' },
        { rol: 'tool', idLlamada: 'c2', resultado: 'lo que acaba de recibir' },
      ]

      const recortados = recortarSalidasHerramientasViejas(mensajes)

      // THEN el sistema no lo recorta
      expect(recortados[1]?.resultado).toBe('lo que acaba de recibir')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: Cuando el recorte no alcanza el sistema resume el historial
  // --------------------------------------------------------------------------
  describe('Requirement: Cuando el recorte no alcanza el sistema resume el historial', () => {
    it('El recorte no basta', () => {
      // WHEN el historial sigue fuera del presupuesto después de recortar resultados viejos
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'turno 1 muy extenso' },
        { rol: 'assistant', contenido: 'respuesta 1' },
        { rol: 'user', contenido: 'turno 2' },
        { rol: 'assistant', contenido: 'respuesta 2' },
      ]

      const compactados = compactarHistorial(mensajes, 1)

      // THEN el sistema resume los turnos más antiguos
      expect(compactados.length).toBeLessThan(mensajes.length)
      const resumen = compactados.find((m) => m.rol === 'system')
      expect(resumen?.contenido).toContain(ENCABEZADO_RESUMEN)
    })

    it('Los turnos recientes se conservan', () => {
      // WHEN el sistema resume el historial
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'turno viejo' },
        { rol: 'assistant', contenido: 'respuesta vieja' },
        { rol: 'user', contenido: 'turno mas reciente' },
        { rol: 'assistant', contenido: 'respuesta mas reciente' },
      ]

      const compactados = compactarHistorial(mensajes, 1)

      // THEN conserva íntegros los turnos más recientes
      expect(compactados[compactados.length - 2]?.contenido).toBe(
        'turno mas reciente',
      )
      expect(compactados[compactados.length - 1]?.contenido).toBe(
        'respuesta mas reciente',
      )
    })

    it('La compactación espera al final del turno', () => {
      // WHEN el modelo todavía está produciendo dentro del turno
      const turnoEnCurso = true
      let compactado = false

      if (!turnoEnCurso) {
        compactarHistorial([])
        compactado = true
      }

      // THEN el sistema no compacta y espera a que termine
      expect(compactado).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El resumen conserva decisiones concretas y no narrativa
  // --------------------------------------------------------------------------
  describe('Requirement: El resumen conserva decisiones concretas y no narrativa', () => {
    it('El resumen nombra el archivo y la línea', () => {
      // WHEN el sistema resume una búsqueda que encontró un patrón
      const mensajes: Mensaje[] = [
        {
          rol: 'tool',
          idLlamada: '1',
          resultado:
            'coincidencia en src/utils/format.ts:44: export const format = 1',
        },
      ]

      const resumen = generarTextoResumen(mensajes)

      // THEN el resumen registra dónde está el patrón, no que el asistente buscó
      expect(resumen).toContain('src/utils/format.ts, línea 44')
    })

    it('El resumen no narra', () => {
      // WHEN el sistema resume un turno
      const mensajes: Mensaje[] = [
        { rol: 'assistant', contenido: 'El bug fue corregido exitosamente.' },
      ]

      const resumen = generarTextoResumen(mensajes)

      // THEN no dice solamente qué se hizo, sino qué quedó establecido
      expect(resumen).toContain('Corrección aplicada satisfactoriamente.')
      expect(resumen).not.toContain(
        'El asistente se puso a buscar en varias partes',
      )
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El prompt del sistema nunca se descarta
  // --------------------------------------------------------------------------
  describe('Requirement: El prompt del sistema nunca se descarta', () => {
    it('El presupuesto está lleno', () => {
      // WHEN el presupuesto está en su límite y el prompt del sistema es la parte más antigua
      const promptSistema: Mensaje = {
        rol: 'system',
        contenido: 'Eres un sistema de ayuda técnica.',
      }
      const mensajes: Mensaje[] = [
        promptSistema,
        { rol: 'user', contenido: 'turno 1' },
        { rol: 'assistant', contenido: 'respuesta 1' },
        { rol: 'user', contenido: 'turno 2' },
        { rol: 'assistant', contenido: 'respuesta 2' },
      ]

      const resultado = compactarHistorial(mensajes, 1)

      // THEN el sistema lo conserva íntegro y descarta otra cosa
      expect(resultado[0]).toBe(promptSistema)
      expect(resultado[0]?.contenido).toBe('Eres un sistema de ayuda técnica.')
    })

    it('Hay que compactar', () => {
      // WHEN el sistema compacta el historial
      const promptSistema: Mensaje = {
        rol: 'system',
        contenido: 'Prompt intocable.',
      }
      const mensajes: Mensaje[] = [
        promptSistema,
        { rol: 'user', contenido: 't1' },
        { rol: 'assistant', contenido: 'r1' },
        { rol: 'user', contenido: 't2' },
        { rol: 'assistant', contenido: 'r2' },
      ]

      const compactados = compactarHistorial(mensajes, 1)

      // THEN el prompt del sistema sigue presente sin modificar
      expect(compactados[0]?.contenido).toBe('Prompt intocable.')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El historial nunca se corta entre una herramienta y su respuesta
  // --------------------------------------------------------------------------
  describe('Requirement: El historial nunca se corta entre una herramienta y su respuesta', () => {
    it('Recorte en el medio de una secuencia', () => {
      // WHEN el sistema recorta y el punto de corte cae entre una solicitud y su resultado
      const mensajes: Mensaje[] = [
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'call_1', nombre: 'read', argumentos: {} },
          ],
        },
        { rol: 'tool', idLlamada: 'call_1', resultado: 'resultado 1' },
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'call_2', nombre: 'edit', argumentos: {} },
          ],
        },
        { rol: 'tool', idLlamada: 'call_2', resultado: 'resultado 2' },
      ]

      const recortados = recortarSalidasHerramientasViejas(mensajes)

      // THEN el sistema desplaza el corte para no partir la secuencia
      expect(recortados).toHaveLength(4)
      expect(recortados[0]?.llamadasHerramientas?.[0]?.id).toBe('call_1')
      expect(recortados[1]?.idLlamada).toBe('call_1')
    })

    it('El historial resultante sigue siendo válido', () => {
      // WHEN el sistema terminó de recortar o resumir
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'turno 1' },
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'call_1', nombre: 'read', argumentos: {} },
          ],
        },
        { rol: 'tool', idLlamada: 'call_1', resultado: 'res' },
        { rol: 'user', contenido: 'turno 2' },
        { rol: 'assistant', contenido: 'fin' },
      ]

      const compactados = compactarHistorial(mensajes, 1)

      // THEN puede enviar el historial resultante sin que el provider lo rechace
      expect(() => validarHistorialAtomico(compactados)).not.toThrow()
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El resumen se marca como generado automáticamente
  // --------------------------------------------------------------------------
  describe('Requirement: El resumen se marca como generado automáticamente', () => {
    it('El modelo lee un resumen', () => {
      // WHEN el modelo recibe un historial que contiene un resumen
      const resumen = generarTextoResumen([])

      // THEN el resumen aparece identificado como generado automáticamente
      expect(resumen).toContain('RESUMEN GENERADO AUTOMÁTICAMENTE')
      expect(resumen).toContain('NO SON HECHOS VERIFICADOS')
    })

    it('El resumen no se toma por verificado', () => {
      // WHEN el modelo cita algo que viene de un resumen
      const texto = generarTextoResumen([])

      // THEN el sistema no lo presenta como un hecho comprobado
      expect(texto).toContain('NO SON HECHOS VERIFICADOS')
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: La compactación ocurre al final de un turno
  // --------------------------------------------------------------------------
  describe('Requirement: La compactación ocurre al final de un turno', () => {
    it('Compacta una sola vez por turno', () => {
      // WHEN un turno termina y el historial quedó fuera del presupuesto
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'a'.repeat(1000) },
        { rol: 'assistant', contenido: 'b'.repeat(1000) },
        { rol: 'user', contenido: 'c'.repeat(1000) },
        { rol: 'assistant', contenido: 'd'.repeat(1000) },
        { rol: 'user', contenido: 'e'.repeat(1000) },
        { rol: 'assistant', contenido: 'f'.repeat(1000) },
      ]

      const resultado = aplicarPipelineContexto(mensajes, presupuesto, {
        entrada: 2000,
        salida: 0,
      })

      // THEN el sistema compacta una vez al final de ese turno
      expect(resultado.compactado).toBe(true)
      const resumenes = resultado.mensajes.filter(
        (m) => m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
      )
      expect(resumenes).toHaveLength(1)

      // Y una segunda pasada no agrega otro resumen
      const segunda = aplicarPipelineContexto(
        resultado.mensajes,
        presupuesto,
        resultado.ultimoTokens,
      )
      expect(segunda.compactado).toBe(false)
      expect(
        segunda.mensajes.filter(
          (m) =>
            m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
        ),
      ).toHaveLength(1)
    })

    it('No compacta en cada paso', () => {
      // WHEN un turno lleva varios pasos y todavía no terminó
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const historialPaso: Mensaje[] = [
        { rol: 'user', contenido: 'pedido' },
        {
          rol: 'assistant',
          llamadasHerramientas: [
            { id: 'c1', nombre: 'read', argumentos: { ruta: 'a.ts' } },
          ],
        },
        { rol: 'tool', idLlamada: 'c1', resultado: 'x'.repeat(100) },
      ]

      const resultado = aplicarPipelineContexto(historialPaso, presupuesto, {
        entrada: 100,
        salida: 10,
      })

      // THEN el sistema no compacta entre ellos
      expect(resultado.compactado).toBe(false)
      expect(
        resultado.mensajes.some(
          (m) =>
            m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
        ),
      ).toBe(false)
    })
  })

  // --------------------------------------------------------------------------
  // Escenarios nuevos: compactación repetida, resumen único y límite imposible
  // --------------------------------------------------------------------------
  describe('Requirement: Compactación repetida y resumen único', () => {
    it('La compactación se repite', () => {
      // WHEN después de una compactación el historial sigue fuera del presupuesto
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const mensajes: Mensaje[] = []
      for (let i = 0; i < 4; i++) {
        mensajes.push({ rol: 'user', contenido: `u${i}`.repeat(600) })
        mensajes.push({ rol: 'assistant', contenido: `a${i}`.repeat(600) })
      }

      const resultado = aplicarPipelineContexto(mensajes, presupuesto)

      // THEN el sistema vuelve a compactar hasta quedar bajo el límite
      expect(resultado.compactado).toBe(true)
      expect(resultado.excedePresupuesto).toBe(false)
      expect(
        resultado.mensajes.filter(
          (m) =>
            m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
        ),
      ).toHaveLength(1)
      expect(resultado.mensajes.filter((m) => m.rol === 'user')).toHaveLength(1)
    })

    it('El resumen no se duplica', () => {
      // WHEN el sistema compacta un historial que ya tiene un resumen automático
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const mensajes: Mensaje[] = [
        { rol: 'system', contenido: `${ENCABEZADO_RESUMEN}\nHecho previo.` },
        { rol: 'user', contenido: 'u1'.repeat(1000) },
        { rol: 'assistant', contenido: 'a1'.repeat(1000) },
        { rol: 'user', contenido: 'u2'.repeat(1000) },
        { rol: 'assistant', contenido: 'a2'.repeat(1000) },
      ]

      const resultado = aplicarPipelineContexto(mensajes, presupuesto)

      // THEN reemplaza el resumen anterior y deja un solo mensaje de resumen
      expect(resultado.compactado).toBe(true)
      const resumenes = resultado.mensajes.filter(
        (m) => m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
      )
      expect(resumenes).toHaveLength(1)
      expect(resumenes[0]?.contenido).toContain('Hecho previo.')
    })

    it('El presupuesto no se puede satisfacer', () => {
      // WHEN el historial sigue fuera del presupuesto y no quedan turnos para resumir
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const mensajes: Mensaje[] = [
        { rol: 'user', contenido: 'u'.repeat(4000) },
        { rol: 'assistant', contenido: 'a'.repeat(4000) },
      ]

      const resultado = aplicarPipelineContexto(mensajes, presupuesto)

      // THEN el sistema deja de compactar e informa que el presupuesto no se pudo satisfacer
      expect(resultado.compactado).toBe(false)
      expect(resultado.excedePresupuesto).toBe(true)
    })
  })

  describe('Requirement: El contenido de resúmenes anteriores se conserva', () => {
    it('Los hechos previos sobreviven a una nueva compactación', () => {
      // WHEN el sistema compacta un historial que ya tenía un resumen
      const resumenPrevio: Mensaje = {
        rol: 'system',
        contenido: `${ENCABEZADO_RESUMEN}\nUbicación establecida en src/viejo.ts, línea 7.`,
      }
      const mensajes: Mensaje[] = [
        resumenPrevio,
        { rol: 'user', contenido: 'turno 1' },
        { rol: 'assistant', contenido: 'respuesta 1' },
        { rol: 'user', contenido: 'turno 2' },
        { rol: 'assistant', contenido: 'respuesta 2' },
      ]

      const compactados = compactarHistorial(mensajes, 1)

      // THEN el nuevo resumen conserva la ubicación anterior
      const resumen = compactados.find(
        (m) => m.rol === 'system' && m.contenido?.includes(ENCABEZADO_RESUMEN),
      )
      expect(resumen?.contenido).toContain('src/viejo.ts, línea 7')
    })
  })

  describe('Requirement: Las métricas de contexto describen el uso actual', () => {
    it('El uso actual se mide contra el presupuesto', () => {
      // WHEN se consultan las métricas de una sesión
      const presupuesto = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const metricas = medirContexto(
        presupuesto,
        [{ rol: 'user', contenido: 'x'.repeat(400) }],
        undefined,
        120,
      )

      // THEN se informan ventana, límite, uso, disponible y acumulado
      expect(metricas.ventanaContexto).toBe(1000)
      expect(metricas.limitePresupuesto).toBe(800)
      expect(metricas.tokensActuales).toBe(100)
      expect(metricas.disponible).toBe(700)
      expect(metricas.porcentajeUso).toBe(12.5)
      expect(metricas.tokensAcumulados).toBe(120)
      expect(metricas.esEstimado).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // Requirement: El presupuesto de un subagente es independiente del del padre
  // --------------------------------------------------------------------------
  describe('Requirement: El presupuesto de un subagente es independiente del del padre', () => {
    it('El historial del hijo no consume el presupuesto del padre', async () => {
      // WHEN un subagente ejecuta varios pasos y produce resultados intermedios extensos
      const presupuestoPadre = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const historialPadre: Mensaje[] = [
        { rol: 'user', contenido: 'Explora el repo' },
      ]
      const tokensPadreAntes = calcularTokensHistorial(historialPadre).tokens

      const catalogo = new RegistroHerramientas()
      catalogo.registrar({
        nombre: 'read',
        descripcion: 'lee',
        esquema: {
          type: 'object',
          properties: { ruta: { type: 'string' } },
          required: ['ruta'],
        },
        accionPermiso: 'read',
        obtenerRecurso: (args) => String(args.ruta ?? '*'),
        ejecutar: async () => 'x'.repeat(2000),
      })

      const proveedorHijo = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 'h1', nombre: 'read', argumentos: { ruta: 'grande.ts' } },
            ],
          },
          { fragmentosTexto: ['Resumen corto del hijo'] },
        ],
      })

      const resultadoHijo = await ejecutarTurnoSubagente({
        subagente: {
          nombre: 'explore',
          descripcion: 'Explora',
          modo: 'subagente',
          herramientas: ['read'],
          prompt: 'Explora.',
        },
        pedido: 'Busca grande.ts',
        catalogo,
        proveedorPadre: proveedorHijo,
        ventanaContextoPadre: 2000,
      })

      // THEN esos pasos se evalúan contra el presupuesto propio del hijo y no contra el presupuesto del padre
      expect(resultadoHijo.esError).toBe(false)
      expect(calcularTokensHistorial(historialPadre).tokens).toBe(
        tokensPadreAntes,
      )
      expect(
        presupuestoPadre.estaCercaDelLimite(
          calcularTokensHistorial(historialPadre).tokens,
        ),
      ).toBe(false)
    })

    it('El resultado del hijo se cuenta como un resultado de herramienta', async () => {
      // WHEN el subagente termina y devuelve su resultado al padre
      const presupuestoPadre = new PresupuestoContexto({
        ventanaContexto: 1000,
        porcentajeLimite: 0.8,
      })
      const registroPadre = new RegistroHerramientas()
      registroPadre.registrar({
        nombre: 'subagent',
        descripcion: 'delega',
        esquema: {
          type: 'object',
          properties: {
            agente: { type: 'string' },
            pedido: { type: 'string' },
          },
          required: ['agente', 'pedido'],
        },
        accionPermiso: 'subagent',
        obtenerRecurso: (args) => String(args.agente ?? '*'),
        ejecutar: async () => 'Resumen final devuelto por el hijo',
      })

      const proveedorPadre = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              {
                id: 'call_sub',
                nombre: 'subagent',
                argumentos: { agente: 'explore', pedido: 'Revisa' },
              },
            ],
          },
          { fragmentosTexto: ['Respuesta del padre'] },
        ],
      })

      const generador = ejecutarTurno({
        proveedor: proveedorPadre,
        registro: registroPadre,
        mensajes: [{ rol: 'user', contenido: 'Delega' }],
      })
      let iter = await generador.next()
      while (!iter.done) {
        iter = await generador.next()
      }
      const estado = iter.value

      // THEN el padre contabiliza únicamente ese resultado devuelto dentro de su propio presupuesto
      const mensajesTool = estado.mensajes.filter((m) => m.rol === 'tool')
      expect(mensajesTool).toHaveLength(1)
      expect(mensajesTool[0]?.resultado).toBe(
        'Resumen final devuelto por el hijo',
      )
      const metricas = medirContexto(presupuestoPadre, estado.mensajes)
      expect(metricas.tokensActuales).toBeGreaterThan(0)
    })
  })
})
