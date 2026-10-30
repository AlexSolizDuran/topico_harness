import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { construirHarness } from '../../src/app.js'
import { recortarSalidasHerramientasViejas } from '../../src/context/index.js'
import { ProveedorSimulado } from '../../src/provider/index.js'
import {
  DEFAULT_TOPE_SKILL_BYTES,
  descubrirSkills,
  ErrorSkillExcedida,
} from '../../src/skills/index.js'

describe('skills Specification Tests (270)', () => {
  const dirs: string[] = []

  function crearDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'harness-skills-'))
    dirs.push(dir)
    return dir
  }

  afterEach(() => {
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  describe('Requirement: El sistema descubre las skills del proyecto al arrancar', () => {
    it('Una skill en forma de directorio', () => {
      // WHEN existe .opencode/skills/git-release/SKILL.md
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'git-release'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'git-release', 'SKILL.md'),
        '---\nname: Git Release\ndescription: Publica una versión\n---\nCuerpo de git release.',
      )

      // THEN el sistema la descubre con el identificador git-release
      const { skills, avisos } = descubrirSkills(dir)
      expect(avisos).toHaveLength(0)
      expect(skills).toHaveLength(1)
      expect(skills[0]?.id).toBe('git-release')
      expect(skills[0]?.nombre).toBe('Git Release')
      expect(skills[0]?.descripcion).toBe('Publica una versión')
    })

    it('Una skill en forma plana', () => {
      // WHEN existe .opencode/skills/revisar-pr.md
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills'), { recursive: true })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'revisar-pr.md'),
        '---\nname: Revisar PR\ndescription: Revisa pull requests\n---\nCuerpo plano.',
      )

      // THEN el sistema la descubre con el identificador revisar-pr
      const { skills } = descubrirSkills(dir)
      expect(skills).toHaveLength(1)
      expect(skills[0]?.id).toBe('revisar-pr')
    })

    it('Un proyecto sin skills', () => {
      // WHEN la raíz del proyecto no tiene .opencode/skills
      const dir = crearDir()
      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['ok'] }],
      })
      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        promptSistema: 'PROMPT_BASE',
      })

      // THEN la sesión arranca igual y el prompt de sistema no cambia
      expect(h.sesion.obtenerEstado().promptSistema).toBe('PROMPT_BASE')
    })

    it('Una skill sin descripción se omite con aviso', () => {
      // WHEN el frontmatter de una skill no declara description
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'sin-desc'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'sin-desc', 'SKILL.md'),
        '---\nname: Sin Desc\n---\nCuerpo.',
      )

      // THEN la skill se omite con un aviso visible y el arranque continúa
      const { skills, avisos, omitidas } = descubrirSkills(dir)
      expect(skills).toHaveLength(0)
      expect(avisos).toHaveLength(1)
      expect(omitidas[0]?.id).toBe('sin-desc')
    })

    it('Un identificador inválido se omite con aviso', () => {
      // WHEN el directorio de una skill no es un slug válido
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'Slug_Invalido!'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'Slug_Invalido!', 'SKILL.md'),
        '---\nname: Inv\ndescription: Desc\n---\nCuerpo.',
      )

      // THEN la skill se omite con un aviso visible y el arranque continúa
      const { skills, avisos, omitidas } = descubrirSkills(dir)
      expect(skills).toHaveLength(0)
      expect(avisos).toHaveLength(1)
      expect(omitidas[0]?.id).toBe('Slug_Invalido!')
    })
  })

  describe('Requirement: El sistema anuncia solo identificador, nombre y descripción', () => {
    it('El catálogo anuncia identificador, nombre y descripción y el cuerpo no viaja hasta la invocación', () => {
      // WHEN hay una skill descubierta
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'mi-skill'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'mi-skill', 'SKILL.md'),
        '---\nname: Mi Skill\ndescription: Hace algo útil\n---\nSECRETO_DEL_CUERPO_DE_LA_SKILL',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['ok'] }],
      })
      const h = construirHarness({ directorioProyecto: dir, proveedor })
      const prompt = h.sesion.obtenerEstado().promptSistema

      // THEN el prompt de sistema incluye su identificador, su nombre y su descripción, pero no el cuerpo
      expect(prompt).toContain('mi-skill')
      expect(prompt).toContain('Mi Skill')
      expect(prompt).toContain('Hace algo útil')
      expect(prompt).not.toContain('SECRETO_DEL_CUERPO_DE_LA_SKILL')
    })

    it('Una skill denegada no se anuncia', () => {
      // WHEN una regla denegar alcanza la acción skill con el identificador de una skill
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'oculta'), { recursive: true })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'oculta', 'SKILL.md'),
        '---\nname: Oculta\ndescription: No debe verse\n---\nCuerpo.',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [{ fragmentosTexto: ['ok'] }],
      })
      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        reglasPermiso: [
          { accion: 'skill', recurso: 'oculta', efecto: 'denegar' },
        ],
      })

      // THEN el prompt de sistema no menciona esa skill
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain('oculta')
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain(
        'No debe verse',
      )
    })
  })

  describe('Requirement: La herramienta skill entrega el cuerpo bajo demanda', () => {
    it('Se invoca una skill existente', async () => {
      // WHEN el modelo invoca skill con un identificador existente
      const dir = crearDir()
      const skillDir = join(dir, '.opencode', 'skills', 'con-apoyo')
      mkdirSync(skillDir, { recursive: true })
      writeFileSync(
        join(skillDir, 'SKILL.md'),
        '---\nname: Con Apoyo\ndescription: Skill con apoyo\n---\nInstrucciones detalladas paso 1.',
      )
      writeFileSync(join(skillDir, 'plantilla.txt'), 'hola')

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 's1', nombre: 'skill', argumentos: { id: 'con-apoyo' } },
            ],
          },
          { fragmentosTexto: ['Aplicada'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Carga con-apoyo')

      // THEN recibe el cuerpo completo, la carpeta base y las rutas de archivos de apoyo
      const toolMsg = h.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(toolMsg?.resultado).toContain('Instrucciones detalladas paso 1.')
      expect(toolMsg?.resultado).toContain(skillDir)
      expect(toolMsg?.resultado).toContain('plantilla.txt')
      // Y el estado visual marca la skill como cargada
      expect(h.sesion.obtenerEstado().skills?.[0]?.cargada).toBe(true)
    })

    it('Se invoca un identificador inexistente', async () => {
      // WHEN el modelo invoca skill con un identificador que no existe
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'existente'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'existente', 'SKILL.md'),
        '---\nname: Existente\ndescription: Existe\n---\nCuerpo.',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 's1', nombre: 'skill', argumentos: { id: 'no-existe' } },
            ],
          },
          { fragmentosTexto: ['Sigue'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Intenta cargar no-existe')

      // THEN recibe un error como texto y el turno continúa
      const toolMsg = h.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(toolMsg?.resultado).toContain(
        'ERROR: Skill no encontrada: no-existe',
      )
      expect(h.sesion.obtenerUltimoTurno()?.tipo).toBe('completado')
    })

    it('El recorte no enmascara el cuerpo de la skill', async () => {
      // WHEN el recorte de contexto procesa el historial con un cuerpo de skill cargado
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'persistente'), {
        recursive: true,
      })
      const cuerpoLargo = `Paso crítico: ${'X'.repeat(2000)}`
      writeFileSync(
        join(dir, '.opencode', 'skills', 'persistente', 'SKILL.md'),
        `---\nname: Persistente\ndescription: No recortar\n---\n${cuerpoLargo}`,
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 's1', nombre: 'skill', argumentos: { id: 'persistente' } },
            ],
          },
          { fragmentosTexto: ['Listo'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Carga persistente')

      const mensajes = [
        ...(h.sesion.obtenerUltimoTurno()?.mensajes ?? []),
        {
          rol: 'assistant' as const,
          llamadasHerramientas: [
            { id: 'r2', nombre: 'read', argumentos: { ruta: 'otro.ts' } },
          ],
        },
        { rol: 'tool' as const, idLlamada: 'r2', resultado: 'reciente' },
      ]

      const recortados = recortarSalidasHerramientasViejas(mensajes)

      // THEN ese cuerpo se conserva y no se reemplaza por el marcador de recorte
      const msgSkill = recortados.find((m) => m.idLlamada === 's1')
      expect(msgSkill?.resultado).toContain(cuerpoLargo)
    })
  })

  describe('Requirement: Las skills respetan los permisos', () => {
    it('Una regla denegar bloquea la skill', async () => {
      // WHEN una regla denegar alcanza la acción skill con ese identificador
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'prohibida'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'prohibida', 'SKILL.md'),
        '---\nname: Prohibida\ndescription: Prohibida\n---\nSecreto.',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 's1', nombre: 'skill', argumentos: { id: 'prohibida' } },
            ],
          },
          { fragmentosTexto: ['Entendido'] },
        ],
      })

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        reglasPermiso: [
          { accion: 'skill', recurso: 'prohibida', efecto: 'denegar' },
        ],
      })
      await h.sesion.enviarMensaje('Invoca prohibida')

      // THEN la skill no se anuncia y la invocación devuelve un error como texto
      expect(h.sesion.obtenerEstado().promptSistema).not.toContain('prohibida')
      const toolMsg = h.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(toolMsg?.resultado).toContain('ERROR: Permiso denegado')
    })

    it('Una regla consultar pide aprobación', async () => {
      // WHEN una regla consultar alcanza la acción skill con ese identificador
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'sensible'), {
        recursive: true,
      })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'sensible', 'SKILL.md'),
        '---\nname: Sensible\ndescription: Sensible\n---\nCuerpo aprobado.',
      )

      let consulto = false
      const proveedor = new ProveedorSimulado({
        respuestas: [
          {
            llamadasHerramienta: [
              { id: 's1', nombre: 'skill', argumentos: { id: 'sensible' } },
            ],
          },
          { fragmentosTexto: ['Hecho'] },
        ],
      })

      const h = construirHarness({
        directorioProyecto: dir,
        proveedor,
        reglasPermiso: [
          { accion: 'skill', recurso: 'sensible', efecto: 'consultar' },
        ],
        manejadorAprobacion: async (solicitud) => {
          expect(solicitud.accion).toBe('skill')
          expect(solicitud.recurso).toBe('sensible')
          consulto = true
          return 'una_vez'
        },
      })
      await h.sesion.enviarMensaje('Usa sensible')

      // THEN el sistema pide aprobación antes de entregar el cuerpo
      expect(consulto).toBe(true)
      const toolMsg = h.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool')
      expect(toolMsg?.resultado).toContain('Cuerpo aprobado.')
    })
  })

  describe('Requirement: Una skill que supera el tope falla en vez de truncarse', () => {
    it('Un archivo justo en el tope no falla y uno que supera el tope falla nombrando archivo, tamaño y tope', () => {
      const dirExacto = crearDir()
      mkdirSync(join(dirExacto, '.opencode', 'skills', 'exacta'), {
        recursive: true,
      })
      const encabezado = '---\nname: Exacta\ndescription: Desc\n---\n'
      const relleno = 'A'.repeat(
        DEFAULT_TOPE_SKILL_BYTES - Buffer.byteLength(encabezado),
      )
      writeFileSync(
        join(dirExacto, '.opencode', 'skills', 'exacta', 'SKILL.md'),
        encabezado + relleno,
      )

      const { skills } = descubrirSkills(dirExacto)
      expect(skills).toHaveLength(1)

      const dirExceso = crearDir()
      mkdirSync(join(dirExceso, '.opencode', 'skills', 'exceso'), {
        recursive: true,
      })
      const rutaExceso = join(
        dirExceso,
        '.opencode',
        'skills',
        'exceso',
        'SKILL.md',
      )
      writeFileSync(rutaExceso, `${encabezado}${relleno}X`)

      try {
        descubrirSkills(dirExceso)
        expect.unreachable('Debió lanzar ErrorSkillExcedida')
      } catch (error) {
        expect(error).toBeInstanceOf(ErrorSkillExcedida)
        const msg = (error as Error).message
        expect(msg).toContain(rutaExceso)
        expect(msg).toContain(String(DEFAULT_TOPE_SKILL_BYTES + 1))
        expect(msg).toContain(String(DEFAULT_TOPE_SKILL_BYTES))
      }
    })
  })

  describe('Requirement: Los subagentes comparten el catálogo de skills', () => {
    it('Un subagente con skill la invoca y uno restringido no puede invocarla', async () => {
      const dir = crearDir()
      mkdirSync(join(dir, '.opencode', 'skills', 'guia'), { recursive: true })
      writeFileSync(
        join(dir, '.opencode', 'skills', 'guia', 'SKILL.md'),
        '---\nname: Guia\ndescription: Guia compartida\n---\nCONTENIDO_DE_GUIA_SUBAGENTE',
      )

      const proveedor = new ProveedorSimulado({
        respuestas: [
          // Padre delega a explore (que tiene 'skill' en solo lectura)
          {
            llamadasHerramienta: [
              {
                id: 't1',
                nombre: 'task',
                argumentos: { agent: 'explore', prompt: 'Usa guia' },
              },
            ],
          },
          // Hijo invoca skill
          {
            llamadasHerramienta: [
              { id: 'hs1', nombre: 'skill', argumentos: { id: 'guia' } },
            ],
          },
          // Hijo responde
          { fragmentosTexto: ['Leí CONTENIDO_DE_GUIA_SUBAGENTE'] },
          // Padre responde
          { fragmentosTexto: ['Completado'] },
        ],
      })

      const h = construirHarness({ directorioProyecto: dir, proveedor })
      await h.sesion.enviarMensaje('Delega')

      const resultadoTask = h.sesion
        .obtenerUltimoTurno()
        ?.mensajes.find((m) => m.rol === 'tool' && m.idLlamada === 't1')
      expect(resultadoTask?.resultado).toContain(
        'Leí CONTENIDO_DE_GUIA_SUBAGENTE',
      )
    })
  })
})
