import { describe, expect, it } from 'vitest'
import {
  aplicarTecla,
  ENTRADA_VACIA,
  type EstadoEntrada,
  insertarTexto,
  navegarHistorial,
  reconocerComando,
} from '../../src/interface/index.js'

function escribir(texto: string): EstadoEntrada {
  return insertarTexto(ENTRADA_VACIA, texto)
}

describe('Entrada de teclado', () => {
  it('escribe y envía con Enter', () => {
    const conTexto = escribir('hola')
    const resultado = aplicarTecla(conTexto, '', { return: true })

    expect(resultado).toMatchObject({ tipo: 'enviar', texto: 'hola' })
    if (resultado.tipo === 'enviar') {
      expect(resultado.estado).toEqual(ENTRADA_VACIA)
    }
  })

  it('borra antes y después del cursor', () => {
    const estado = { buffer: 'abc', cursor: 2 }
    const antes = aplicarTecla(estado, '', { backspace: true })
    expect(antes).toMatchObject({
      tipo: 'edicion',
      estado: { buffer: 'ac', cursor: 1 },
    })

    const despues = aplicarTecla(estado, '', { delete: true })
    expect(despues).toMatchObject({
      tipo: 'edicion',
      estado: { buffer: 'ab', cursor: 2 },
    })
  })

  it('mueve el cursor con flechas, Home y End', () => {
    const estado = { buffer: 'abc', cursor: 1 }
    expect(aplicarTecla(estado, '', { leftArrow: true })).toMatchObject({
      estado: { cursor: 0 },
    })
    expect(aplicarTecla(estado, '', { rightArrow: true })).toMatchObject({
      estado: { cursor: 2 },
    })
    expect(aplicarTecla(estado, '', { home: true })).toMatchObject({
      estado: { cursor: 0 },
    })
    expect(aplicarTecla(estado, '', { end: true })).toMatchObject({
      estado: { cursor: 3 },
    })
  })

  it('cancela con Ctrl+C y sale con Ctrl+D', () => {
    expect(aplicarTecla(ENTRADA_VACIA, 'c', { ctrl: true }).tipo).toBe(
      'cancelar',
    )
    expect(aplicarTecla(ENTRADA_VACIA, 'd', { ctrl: true }).tipo).toBe('salir')
  })

  it('reconoce /modelo sin enviarlo como pedido', () => {
    const resultado = aplicarTecla(
      escribir('/modelo openrouter/openai/gpt-4o'),
      '',
      {
        return: true,
      },
    )

    expect(resultado).toMatchObject({
      tipo: 'comando',
      comando: 'modelo',
      argumentos: 'openrouter/openai/gpt-4o',
    })
  })

  it('reconoce /modelo sin argumentos', () => {
    expect(reconocerComando('/modelo')).toEqual({
      comando: 'modelo',
      argumentos: '',
    })
    expect(reconocerComando('hola')).toBeUndefined()
  })

  it('inserta un pegado como una sola operación', () => {
    const estado = { buffer: 'ab', cursor: 1 }
    const resultado = insertarTexto(estado, 'XY')
    expect(resultado).toEqual({ buffer: 'aXYb', cursor: 3 })
  })

  it('insertar un salto de línea no descarta el texto', () => {
    const conTexto = escribir('linea 1')
    const resultado = aplicarTecla(conTexto, '', {
      return: true,
      shift: true,
    })

    expect(resultado).toMatchObject({
      tipo: 'edicion',
      estado: { buffer: 'linea 1\n', cursor: 8 },
    })
  })

  it('envía un pedido de varias líneas', () => {
    const conLineas = insertarTexto(escribir('primera'), '\nsegunda')
    const resultado = aplicarTecla(conLineas, '', { return: true })

    expect(resultado).toMatchObject({
      tipo: 'enviar',
      texto: 'primera\nsegunda',
    })
  })

  it('navega el historial y vuelve al borrador', () => {
    const primero = navegarHistorial(
      ['uno', 'dos'],
      null,
      '',
      'arriba',
      'borrador',
    )
    expect(primero).toMatchObject({
      indice: 1,
      texto: 'dos',
      borrador: 'borrador',
    })

    const segundo = navegarHistorial(
      ['uno', 'dos'],
      primero.indice,
      primero.borrador,
      'arriba',
      primero.texto,
    )
    expect(segundo).toMatchObject({ indice: 0, texto: 'uno' })

    const vuelta = navegarHistorial(
      ['uno', 'dos'],
      segundo.indice,
      segundo.borrador,
      'abajo',
      segundo.texto,
    )
    expect(vuelta).toMatchObject({ indice: 1, texto: 'dos' })

    const fin = navegarHistorial(
      ['uno', 'dos'],
      vuelta.indice,
      vuelta.borrador,
      'abajo',
      vuelta.texto,
    )
    expect(fin).toMatchObject({ indice: null, texto: 'borrador' })
  })
})
