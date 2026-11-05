import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { validarDefinicionAgente } from '../../src/agents/definiciones.js'
import { cargarConfig, ErrorConfiguracion } from '../../src/provider/config.js'

function escribirProyecto(dir: string, extra: Record<string, unknown>): void {
  mkdirSync(join(dir, '.harness'), { recursive: true })
  writeFileSync(
    join(dir, '.harness', 'config.json'),
    JSON.stringify({
      proveedores: {
        local: {
          tipo: 'openai-compatible',
          baseUrl: 'http://localhost:11434/v1',
          modelos: [{ id: 'modelo' }],
        },
      },
      ...extra,
    }),
  )
}

function conProyectoTemporal(
  extra: Record<string, unknown>,
  fn: (dir: string) => void,
): void {
  const dir = mkdtempSync(join(tmpdir(), 'harness-integracion-'))
  try {
    escribirProyecto(dir, extra)
    fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('Integración de configuración', () => {
  it('acepta sandbox, memoria, lsp y mcp válidos', () => {
    conProyectoTemporal(
      {
        sandbox: { habilitado: false },
        memoria: { usuario: true, modelo: 'local/modelo' },
        lsp: [
          {
            lenguaje: 'typescript',
            extensiones: ['.ts'],
            comando: 'typescript-language-server',
            args: ['--stdio'],
            raiz: '.',
          },
        ],
        mcp: [
          {
            id: 'filesystem',
            comando: 'npx',
            args: ['-y', 'server'],
            env: ['GITHUB_TOKEN'],
          },
        ],
      },
      (dir) => {
        const cfg = cargarConfig({
          directorioProyecto: dir,
          directorioGlobal: join(dir, 'no-existe.json'),
        })
        expect(cfg.sandbox).toEqual({ habilitado: false })
        expect(cfg.memoria).toEqual({
          usuario: true,
          modelo: 'local/modelo',
        })
        expect(cfg.lsp?.[0]?.lenguaje).toBe('typescript')
        expect(cfg.mcp?.[0]?.env).toEqual(['GITHUB_TOKEN'])
      },
    )
  })

  it('rechaza un servidor MCP sin comando', () => {
    conProyectoTemporal({ mcp: [{ id: 'roto' }] }, (dir) => {
      expect(() =>
        cargarConfig({
          directorioProyecto: dir,
          directorioGlobal: join(dir, 'no-existe.json'),
        }),
      ).toThrow(/roto.*comando/)
    })
  })

  it('rechaza un secreto literal en mcp.env sin imprimirlo', () => {
    const secreto = 'ghp_secreto_literal_1234567890'
    conProyectoTemporal(
      { mcp: [{ id: 'seguro', comando: 'node', env: [secreto] }] },
      (dir) => {
        try {
          cargarConfig({
            directorioProyecto: dir,
            directorioGlobal: join(dir, 'no-existe.json'),
          })
          expect.unreachable('Debió rechazar el secreto literal')
        } catch (error) {
          expect(error).toBeInstanceOf(ErrorConfiguracion)
          expect((error as Error).message).not.toContain(secreto)
        }
      },
    )
  })

  it('rechaza una entrada LSP incompleta', () => {
    conProyectoTemporal(
      { lsp: [{ lenguaje: 'typescript', comando: 'server' }] },
      (dir) => {
        expect(() =>
          cargarConfig({
            directorioProyecto: dir,
            directorioGlobal: join(dir, 'no-existe.json'),
          }),
        ).toThrow(/typescript.*raiz/)
      },
    )
  })

  it('el proyecto pisa la entrada global con la misma identidad', () => {
    const dir = mkdtempSync(join(tmpdir(), 'harness-integracion-merge-'))
    try {
      const rutaGlobal = join(dir, 'global.json')
      writeFileSync(
        rutaGlobal,
        JSON.stringify({
          proveedores: {
            local: {
              tipo: 'openai-compatible',
              baseUrl: 'http://localhost:11434/v1',
              modelos: [{ id: 'modelo' }],
            },
          },
          mcp: [
            { id: 'a', comando: 'global-a' },
            { id: 'b', comando: 'global-b' },
          ],
          lsp: [{ lenguaje: 'typescript', comando: 'global-ts', raiz: '.' }],
        }),
      )
      escribirProyecto(dir, {
        mcp: [
          { id: 'b', comando: 'proyecto-b' },
          { id: 'c', comando: 'proyecto-c' },
        ],
        lsp: [{ lenguaje: 'typescript', comando: 'proyecto-ts', raiz: '.' }],
      })

      const cfg = cargarConfig({
        directorioProyecto: dir,
        directorioGlobal: rutaGlobal,
      })
      expect(cfg.mcp?.map((s) => `${s.id}:${s.comando}`)).toEqual([
        'a:global-a',
        'b:proyecto-b',
        'c:proyecto-c',
      ])
      expect(cfg.lsp?.map((s) => s.comando)).toEqual(['proyecto-ts'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('Integración de agentes con MCP', () => {
  const base = {
    nombre: 'build',
    descripcion: 'principal',
    modo: 'primario',
    herramientas: ['read'],
  }

  it('acepta un servidor declarado y configurado', () => {
    const agente = validarDefinicionAgente(
      { ...base, mcp: ['filesystem'] },
      {
        herramientasDisponibles: ['read'],
        servidoresMcp: ['filesystem'],
      },
    )
    expect(agente.mcp).toEqual(['filesystem'])
  })

  it('rechaza un servidor no configurado', () => {
    expect(() =>
      validarDefinicionAgente(
        { ...base, mcp: ['inexistente'] },
        {
          herramientasDisponibles: ['read'],
          servidoresMcp: ['filesystem'],
        },
      ),
    ).toThrow(/inexistente/)
  })

  it('un agente sin declaración no recibe servidores', () => {
    const agente = validarDefinicionAgente(base, {
      herramientasDisponibles: ['read'],
      servidoresMcp: ['filesystem'],
    })
    expect(agente.mcp).toBeUndefined()
  })
})
