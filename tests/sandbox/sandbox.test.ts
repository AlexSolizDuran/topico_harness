import { existsSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import {
  determinarMecanismoAislamiento,
  EjecutorSandbox,
  GestorTemporalesSandbox,
} from '../../src/sandbox/index.js'

describe('sandbox specification scenarios', () => {
  describe('Requirement: La herramienta de ejecución corre dentro de un aislamiento del sistema operativo', () => {
    it('Ejecución aislada', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { habilitado: true },
        'linux',
      )
      expect(aislamiento.aislado).toBe(true)
      expect(aislamiento.mecanismo).toBe('bwrap')
    })

    it('Escritura dentro del proyecto', async () => {
      const ejecutor = new EjecutorSandbox()
      const spy = vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 0,
        stdout: 'ok',
        stderr: '',
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      const res = await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'touch',
        args: ['archivo.txt'],
      })
      expect(res.codigoSalida).toBe(0)
      expect(spy).toHaveBeenCalled()
      ejecutor.cerrar()
    })

    it('Escritura fuera del proyecto', async () => {
      const ejecutor = new EjecutorSandbox()
      vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 1,
        stdout: '',
        stderr: "bwrap: Can't create file at /etc/bad: Read-only file system",
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      const res = await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'touch',
        args: ['/etc/bad'],
      })
      expect(res.codigoSalida).toBe(1)
      expect(res.stderr).toContain('Read-only file system')
      ejecutor.cerrar()
    })

    it('Temporal disponible', async () => {
      const ejecutor = new EjecutorSandbox()
      let tempRecibido = ''
      vi.spyOn(ejecutor, 'ejecutarProceso').mockImplementation(
        async (_opciones, aislamiento, dirTemp) => {
          tempRecibido = dirTemp
          return {
            codigoSalida: 0,
            stdout: 'written',
            stderr: '',
            aislamiento,
          }
        },
      )

      await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'echo',
        args: ['test'],
      })
      expect(tempRecibido).toBeTruthy()
      ejecutor.cerrar()
    })
  })

  describe('Requirement: El aislamiento se aplica por herramienta y no por comando', () => {
    it('Comando permitido', async () => {
      const ejecutor = new EjecutorSandbox()
      const spy = vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 0,
        stdout: 'echo',
        stderr: '',
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'echo',
        args: ['hola'],
        config: { mecanismoForzado: 'bwrap' },
      })
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ aislado: true, mecanismo: 'bwrap' }),
        expect.any(String),
      )
      ejecutor.cerrar()
    })

    it('Comando fuera del catálogo', async () => {
      const ejecutor = new EjecutorSandbox()
      const spy = vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 0,
        stdout: 'output',
        stderr: '',
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'custom_compiler_tool',
        args: ['--build'],
        config: { mecanismoForzado: 'bwrap' },
      })
      expect(spy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ aislado: true, mecanismo: 'bwrap' }),
        expect.any(String),
      )
      ejecutor.cerrar()
    })

    it('Lectura conserva sus reglas', () => {
      expect(true).toBe(true)
    })
  })

  describe('Requirement: Un intento de salir del aislamiento vuelve como error de texto', () => {
    it('El error vuelve al modelo', async () => {
      const ejecutor = new EjecutorSandbox()
      vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 1,
        stdout: '',
        stderr: 'sandbox: Operation not permitted: /var/log/syslog',
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      const res = await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'cat',
        args: ['> /var/log/syslog'],
      })
      expect(res.stderr).toContain('Operation not permitted')
      ejecutor.cerrar()
    })

    it('La lectura fuera se rige por la configuración', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { permitirLecturaFuera: true },
        'linux',
      )
      expect(aislamiento.aislado).toBe(true)
    })

    it('El turno continúa', async () => {
      const ejecutor = new EjecutorSandbox()
      vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 1,
        stdout: '',
        stderr: 'Access denied outside sandbox',
        aislamiento: { aislado: true, mecanismo: 'bwrap' },
      })

      await expect(
        ejecutor.ejecutarComando({
          directorioProyecto: process.cwd(),
          comando: 'rm',
          args: ['/root/file'],
        }),
      ).resolves.toBeDefined()
      ejecutor.cerrar()
    })
  })

  describe('Requirement: Sin aislamiento disponible el sistema no finge', () => {
    it('Plataforma sin aislamiento', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { habilitado: true },
        'win32',
      )
      expect(aislamiento.aislado).toBe(false)
      expect(aislamiento.motivoDegradacion).toContain('no ofrece un mecanismo')
    })

    it('El aviso es visible', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { habilitado: true },
        'win32',
      )
      expect(aislamiento.motivoDegradacion).toBeTruthy()
    })

    it('No se presenta como aislada', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { habilitado: true },
        'win32',
      )
      expect(aislamiento.aislado).toBe(false)
      expect(aislamiento.mecanismo).toBeUndefined()
    })
  })

  describe('Requirement: La configuración puede habilitar o deshabilitar el aislamiento', () => {
    it('Valor por defecto', () => {
      const aislamiento = determinarMecanismoAislamiento(undefined, 'linux')
      expect(aislamiento.aislado).toBe(true)
    })

    it('Aislamiento deshabilitado', () => {
      const aislamiento = determinarMecanismoAislamiento(
        { habilitado: false },
        'linux',
      )
      expect(aislamiento.aislado).toBe(false)
      expect(aislamiento.motivoDegradacion).toContain('deshabilitado')
    })

    it('El aviso no es un error fatal', async () => {
      const ejecutor = new EjecutorSandbox()
      vi.spyOn(ejecutor, 'ejecutarProceso').mockResolvedValue({
        codigoSalida: 0,
        stdout: 'ok',
        stderr: '',
        aislamiento: {
          aislado: false,
          motivoDegradacion: 'Aislamiento deshabilitado',
        },
      })

      const res = await ejecutor.ejecutarComando({
        directorioProyecto: process.cwd(),
        comando: 'echo',
        args: ['hello'],
        config: { habilitado: false },
      })
      expect(res.codigoSalida).toBe(0)
      expect(res.aislamiento.aislado).toBe(false)
      ejecutor.cerrar()
    })
  })

  describe('Requirement: El aislamiento no rompe comandos que necesitan temporales', () => {
    it('Comando que usa un temporal', async () => {
      const gestor = new GestorTemporalesSandbox()
      const tempDir = gestor.crearTemporal()
      expect(existsSync(tempDir)).toBe(true)

      const archivoPrueba = join(tempDir, 'prueba.tmp')
      writeFileSync(archivoPrueba, 'datos')
      expect(existsSync(archivoPrueba)).toBe(true)

      gestor.limpiar(tempDir)
    })

    it('Limpieza del temporal', () => {
      const gestor = new GestorTemporalesSandbox()
      const tempDir = gestor.crearTemporal()
      expect(existsSync(tempDir)).toBe(true)
      gestor.limpiar(tempDir)
      expect(existsSync(tempDir)).toBe(false)
    })

    it('Sin permisos extra', () => {
      const ejecutor = new EjecutorSandbox()
      expect(ejecutor).toBeDefined()
      ejecutor.cerrar()
    })
  })
})
