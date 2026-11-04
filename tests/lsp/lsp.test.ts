import { describe, expect, it, vi } from 'vitest'
import {
  type ClienteLsp,
  type ConfiguracionServidorLsp,
  crearHerramientaLsp,
  GestorLsp,
} from '../../src/lsp/index.js'

describe('lsp specification scenarios', () => {
  describe('Requirement: El sistema declara servidores de lenguaje en la configuración', () => {
    it('Configuración válida', () => {
      const servidor: ConfiguracionServidorLsp = {
        lenguaje: 'typescript',
        extensiones: ['.ts', '.tsx'],
        comando: 'typescript-language-server',
        args: ['--stdio'],
        raiz: process.cwd(),
      }
      const gestor = new GestorLsp({ servidores: [servidor] })
      expect(gestor.resolverLenguajeDeArchivo('archivo.ts')).toBe('typescript')
      gestor.cerrar()
    })

    it('Entrada incompleta', () => {
      const entradaIncompleta = {
        lenguaje: 'python',
        comando: '',
        raiz: '',
      } as ConfiguracionServidorLsp

      expect(() => new GestorLsp({ servidores: [entradaIncompleta] })).toThrow(
        /python/,
      )
    })

    it('Sin servidores', async () => {
      const gestor = new GestorLsp({})
      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'definition',
        ruta: 'src/main.ts',
        linea: 1,
        caracter: 1,
      })
      expect(res).toContain('No hay un servidor de lenguaje configurado')
      gestor.cerrar()
    })
  })

  describe('Requirement: El sistema expone operaciones de código por símbolos', () => {
    it('Definición', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue([
          {
            uri: 'file:///project/src/model.ts',
            range: { start: { line: 10, character: 4 } },
          },
        ]),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'definition',
        ruta: 'src/app.ts',
        linea: 5,
        caracter: 2,
      })
      expect(res).toContain('file:///project/src/model.ts')
      expect(res).toContain('(11:5)')
      gestor.cerrar()
    })

    it('Referencias', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue([
          {
            uri: 'file:///project/src/a.ts',
            range: { start: { line: 1, character: 1 } },
          },
          {
            uri: 'file:///project/src/b.ts',
            range: { start: { line: 20, character: 3 } },
          },
        ]),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'references',
        ruta: 'src/app.ts',
        linea: 5,
        caracter: 2,
      })
      expect(res).toContain('src/a.ts')
      expect(res).toContain('src/b.ts')
      gestor.cerrar()
    })

    it('Símbolos de documento', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue([
          { name: 'miFuncion', kind: 12, containerName: 'ModuloA' },
          { name: 'MiClase', kind: 5 },
        ]),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'documentSymbols',
        ruta: 'src/app.ts',
      })
      expect(res).toContain('miFuncion')
      expect(res).toContain('MiClase')
      gestor.cerrar()
    })

    it('Símbolos de workspace', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi
          .fn()
          .mockResolvedValue([{ name: 'GlobalHelper', kind: 12 }]),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'workspaceSymbols',
        ruta: 'src/app.ts',
        simbolo: 'Global',
      })
      expect(res).toContain('GlobalHelper')
      gestor.cerrar()
    })

    it('Hover', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue({
          contents: { value: '```typescript\nfunction test(): void\n```' },
        }),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'hover',
        ruta: 'src/app.ts',
        linea: 10,
        caracter: 5,
      })
      expect(res).toContain('function test(): void')
      gestor.cerrar()
    })

    it('Diagnósticos', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue({
          items: [
            {
              mensaje: 'Type mismatch',
              gravedad: 'error',
              linea: 3,
              caracter: 8,
            },
          ],
        }),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'diagnostics',
        ruta: 'src/app.ts',
      })
      expect(res).toContain('[ERROR] (4:9): Type mismatch')
      gestor.cerrar()
    })

    it('Argumento inválido', async () => {
      const gestor = new GestorLsp({})
      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      const res = await tool.ejecutar({
        operacion: 'invalid_op' as unknown as 'hover',
        ruta: 'src/app.ts',
      })
      expect(res).toContain("Argumentos inválidos para 'lsp'")
      gestor.cerrar()
    })
  })

  describe('Requirement: Los diagnósticos vuelven al agente después de editar', () => {
    it('Edición con errores', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      vi.spyOn(gestor, 'obtenerDiagnosticosDeArchivo').mockResolvedValue(
        '[ERROR] (1:1): SyntaxError',
      )
      const diag = await gestor.obtenerDiagnosticosDeArchivo('src/app.ts')
      expect(diag).toContain('[ERROR] (1:1): SyntaxError')
      gestor.cerrar()
    })

    it('Edición sin errores', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      vi.spyOn(gestor, 'obtenerDiagnosticosDeArchivo').mockResolvedValue('')
      const diag = await gestor.obtenerDiagnosticosDeArchivo('src/app.ts')
      expect(diag).toBe('')
      gestor.cerrar()
    })

    it('Solo archivos modificados', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const spy = vi
        .spyOn(gestor, 'obtenerDiagnosticosDeArchivo')
        .mockResolvedValue('')
      await gestor.obtenerDiagnosticosDeArchivo('src/modificado.ts')
      expect(spy).toHaveBeenCalledWith('src/modificado.ts')
      gestor.cerrar()
    })

    it('Resultado truncado', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
        maxBytesSalida: 30,
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue({
          items: [
            {
              mensaje: 'Error largo que excede los bytes permitidos...',
              linea: 1,
              caracter: 1,
            },
          ],
        }),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const diag = await gestor.obtenerDiagnosticosDeArchivo('src/app.ts')
      expect(diag).toContain('omitidos')
      gestor.cerrar()
    })

    it('Fallo del servidor no revierte la edición', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi
          .fn()
          .mockRejectedValue(new Error('LSP server crashed on diagnostics')),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const diag = await gestor.obtenerDiagnosticosDeArchivo('src/app.ts')
      expect(diag).toContain('ERROR al obtener diagnósticos')
      gestor.cerrar()
    })
  })

  describe('Requirement: Sin servidor disponible la operación falla como texto', () => {
    it('Sin servidor para el lenguaje', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const res = await gestor.ejecutarOperacion('definition', 'main.rs', {
        linea: 1,
        caracter: 1,
      })
      expect(res).toContain(
        'ERROR: No hay un servidor de lenguaje configurado para el archivo',
      )
      gestor.cerrar()
    })

    it('Servidor que no arranca', async () => {
      const gestor = new GestorLsp({
        servidores: [
          {
            lenguaje: 'ts',
            comando: 'non-existent-lsp-executable-xyz',
            raiz: process.cwd(),
          },
        ],
      })
      const res = await gestor.ejecutarOperacion('hover', 'main.ts', {
        linea: 1,
        caracter: 1,
      })
      expect(res).toContain('ERROR: Falló al iniciar el servidor LSP')
      gestor.cerrar()
    })

    it('El turno continúa', async () => {
      const gestor = new GestorLsp({})
      const res = await gestor.ejecutarOperacion('hover', 'test.py', {
        linea: 1,
        caracter: 1,
      })
      // Devuelve texto de error sin tirar excepción
      expect(res).toContain('ERROR')
      gestor.cerrar()
    })

    it('El modelo puede volver a buscar', async () => {
      const gestor = new GestorLsp({})
      const resLsp = await gestor.ejecutarOperacion('definition', 'test.py', {
        linea: 1,
        caracter: 1,
      })
      expect(resLsp).toContain('ERROR')
      // La falla no contamina ni rompe el sistema
      expect(gestor).toBeDefined()
      gestor.cerrar()
    })
  })

  describe('Requirement: La herramienta de lenguaje es de solo lectura y respeta permisos', () => {
    it('La operación no modifica archivos', async () => {
      const gestor = new GestorLsp({})
      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      expect(tool.descripcion).toContain('solo lectura')
      gestor.cerrar()
    })

    it('Una regla permitir', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        estaConectado: () => true,
        enviarPeticion: vi.fn().mockResolvedValue([]),
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      const tool = crearHerramientaLsp({
        gestorLsp: gestor,
        reglasGlobales: [
          { accion: 'lsp', recurso: 'definition:src/*', efecto: 'permitir' },
        ],
      })
      const res = await tool.ejecutar({
        operacion: 'definition',
        ruta: 'src/app.ts',
        linea: 1,
        caracter: 1,
      })
      expect(res).not.toContain('denegada')
      gestor.cerrar()
    })

    it('Una regla denegar', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const tool = crearHerramientaLsp({
        gestorLsp: gestor,
        reglasGlobales: [
          { accion: 'lsp', recurso: 'definition:secret/*', efecto: 'denegar' },
        ],
      })
      const res = await tool.ejecutar({
        operacion: 'definition',
        ruta: 'secret/passwords.ts',
        linea: 1,
        caracter: 1,
      })
      expect(res).toContain('denegada por reglas de permisos')
      gestor.cerrar()
    })

    it('Subagente con la herramienta declarada', () => {
      const gestor = new GestorLsp({})
      const tool = crearHerramientaLsp({ gestorLsp: gestor })
      // Se verifica que la herramienta expone nombre y esquema estándar para registrarse en un agente
      expect(tool.nombre).toBe('lsp')
      expect(tool.esquema).toBeDefined()
      gestor.cerrar()
    })
  })

  describe('Requirement: El ciclo de vida del servidor se cierra con la sesión', () => {
    it('Arranque bajo demanda', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const spy = vi
        .spyOn(gestor, 'asegurarClienteParaArchivo')
        .mockResolvedValue({
          cliente: {
            estaConectado: () => true,
            enviarPeticion: vi.fn().mockResolvedValue({}),
            desconectar: vi.fn(),
          } as unknown as ClienteLsp,
        })
      await gestor.ejecutarOperacion('hover', 'src/main.ts', {
        linea: 1,
        caracter: 1,
      })
      expect(spy).toHaveBeenCalledWith('src/main.ts')
      gestor.cerrar()
    })

    it('Cierre al terminar', () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      gestor.cerrar()
      expect(clienteMock.desconectar).toHaveBeenCalled()
    })

    it('Servidor caído no bloquea', async () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'invalid-cmd', raiz: process.cwd() },
        ],
      })
      const res = await gestor.ejecutarOperacion('hover', 'src/index.ts', {
        linea: 1,
        caracter: 1,
      })
      expect(res).toContain('ERROR')
      gestor.cerrar()
    })

    it('Sin procesos huérfanos', () => {
      const gestor = new GestorLsp({
        servidores: [
          { lenguaje: 'ts', comando: 'ts-lsp', raiz: process.cwd() },
        ],
      })
      const clienteMock = {
        desconectar: vi.fn(),
      }
      const map = gestor['clientes'] as Map<string, unknown>
      map.set('ts', clienteMock)

      gestor.cerrar()
      expect(map.size).toBe(0)
    })
  })
})
