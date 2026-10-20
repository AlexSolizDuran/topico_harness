import { Box, Static, Text, useApp, useInput, usePaste } from 'ink'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Aviso,
  BarraEstado,
  CajaEntrada,
  ComponenteElemento,
  ComponentePromptSistema,
  MensajeAsistente,
  PaletaComandos,
  PanelAyuda,
  PanelContexto,
  PieAtajos,
  SelectorModelo,
  TarjetaHerramientaEnCurso,
} from './app.js'
import { filtrarComandos } from './commands.js'
import {
  aplicarTecla,
  ENTRADA_VACIA,
  type EstadoEntrada,
  insertarTexto,
  navegarHistorial,
} from './input.js'
import type { SesionInteractiva } from './runner.js'
import type { EstadoSesionVisual } from './state.js'

export interface PropsAppInteractiva {
  sesion: SesionInteractiva
  pedidoInicial?: string | undefined
  directorio?: string | undefined
}

export function AppInteractiva({
  sesion,
  pedidoInicial,
  directorio,
}: PropsAppInteractiva): React.JSX.Element {
  const { exit } = useApp()
  const [estado, setEstado] = useState<EstadoSesionVisual>(
    sesion.obtenerEstado(),
  )
  const [entrada, setEntrada] = useState<EstadoEntrada>(ENTRADA_VACIA)
  const [aviso, setAviso] = useState('')
  const [historialEntradas, setHistorialEntradas] = useState<string[]>([])
  const [indiceHistorial, setIndiceHistorial] = useState<number | null>(null)
  const [borradorHistorial, setBorradorHistorial] = useState('')
  const [indicePaleta, setIndicePaleta] = useState(0)
  const [selectorModeloAbierto, setSelectorModeloAbierto] = useState(false)
  const [indiceModelo, setIndiceModelo] = useState(0)
  const [filtroModelo, setFiltroModelo] = useState('')
  const [panel, setPanel] = useState<'contexto' | 'ayuda' | null>(null)
  const enviandoRef = useRef(false)
  const inicialEnviado = useRef(false)

  useEffect(() => {
    sesion.establecerActualizador((nuevo) => {
      setEstado({ ...nuevo, historial: [...nuevo.historial] })
    })
    return () => sesion.establecerActualizador(undefined)
  }, [sesion])

  const paletaAbierta =
    panel === null &&
    !selectorModeloAbierto &&
    entrada.buffer.startsWith('/') &&
    !entrada.buffer.includes(' ')
  const filtroPaleta = entrada.buffer.startsWith('/')
    ? entrada.buffer.slice(1)
    : ''
  const comandosFiltrados = filtrarComandos(filtroPaleta)
  const indicePaletaSeguro =
    comandosFiltrados.length === 0
      ? 0
      : Math.min(indicePaleta, comandosFiltrados.length - 1)

  const modelos = sesion.listarModelos()
  const modelosFiltrados = filtroModelo
    ? modelos.filter((modelo) =>
        modelo.toLowerCase().includes(filtroModelo.toLowerCase()),
      )
    : modelos
  const indiceModeloSeguro =
    modelosFiltrados.length === 0
      ? 0
      : Math.min(indiceModelo, modelosFiltrados.length - 1)

  const enviar = async (texto: string): Promise<void> => {
    if (enviandoRef.current) return
    if (sesion.obtenerEstado().turnoEnCurso) {
      setAviso('Esperá a que termine el turno para enviar otro pedido.')
      return
    }
    enviandoRef.current = true
    setAviso('')
    setHistorialEntradas((actual) => [...actual, texto])
    setIndiceHistorial(null)
    setBorradorHistorial('')
    try {
      await sesion.enviarMensaje(texto)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    } finally {
      enviandoRef.current = false
    }
  }

  const enviarRef = useRef(enviar)
  enviarRef.current = enviar

  useEffect(() => {
    if (pedidoInicial && !inicialEnviado.current) {
      inicialEnviado.current = true
      void enviarRef.current(pedidoInicial)
    }
  }, [pedidoInicial])

  const abrirSelectorModelo = (): void => {
    if (sesion.obtenerEstado().turnoEnCurso) {
      setAviso('No se puede cambiar de modelo durante un turno.')
      return
    }
    if (modelos.length === 0) {
      setAviso('No hay modelos configurados.')
      return
    }
    setFiltroModelo('')
    setIndiceModelo(0)
    setSelectorModeloAbierto(true)
    setAviso('')
  }

  const seleccionarModelo = (): void => {
    const modelo = modelosFiltrados[indiceModeloSeguro]
    if (!modelo) return
    try {
      sesion.cambiarModelo(modelo)
      setSelectorModeloAbierto(false)
      setFiltroModelo('')
      setAviso(`Modelo activo: ${sesion.obtenerModeloActivo()}`)
    } catch (error) {
      setAviso(error instanceof Error ? error.message : String(error))
    }
  }

  const ejecutarComando = (comando: string, argumentos: string): void => {
    const id = comando.toLowerCase()

    if (id === 'modelo' || id === 'model') {
      if (!argumentos) {
        abrirSelectorModelo()
        return
      }
      if (sesion.obtenerEstado().turnoEnCurso) {
        setAviso('No se puede cambiar de modelo durante un turno.')
        return
      }
      try {
        sesion.cambiarModelo(argumentos)
        setAviso(`Modelo activo: ${sesion.obtenerModeloActivo()}`)
      } catch (error) {
        setAviso(error instanceof Error ? error.message : String(error))
      }
      return
    }

    if (id === 'contexto' || id === 'context') {
      setPanel('contexto')
      return
    }

    if (id === 'ayuda' || id === 'help') {
      setPanel('ayuda')
      return
    }

    if (id === 'salir' || id === 'quit' || id === 'exit') {
      exit()
      return
    }

    setAviso(`Comando desconocido: /${comando}`)
  }

  useInput((input, key) => {
    if (panel !== null) {
      if (key.escape) setPanel(null)
      return
    }

    if (selectorModeloAbierto) {
      if (key.escape) {
        setSelectorModeloAbierto(false)
        setFiltroModelo('')
        return
      }
      if (key.upArrow) {
        setIndiceModelo((actual) => Math.max(0, actual - 1))
        return
      }
      if (key.downArrow) {
        setIndiceModelo((actual) =>
          Math.min(modelosFiltrados.length - 1, actual + 1),
        )
        return
      }
      if (key.return) {
        seleccionarModelo()
        return
      }
      if (key.backspace) {
        setFiltroModelo((actual) => actual.slice(0, -1))
        setIndiceModelo(0)
        return
      }
      if (input && !key.ctrl && !key.meta && !key.escape && !key.tab) {
        setFiltroModelo((actual) => `${actual}${input}`)
        setIndiceModelo(0)
      }
      return
    }

    if (paletaAbierta) {
      if (key.escape) {
        setEntrada(ENTRADA_VACIA)
        return
      }
      if (key.upArrow) {
        setIndicePaleta((actual) => Math.max(0, actual - 1))
        return
      }
      if (key.downArrow) {
        setIndicePaleta((actual) =>
          Math.min(comandosFiltrados.length - 1, actual + 1),
        )
        return
      }
      if (key.return && !key.shift) {
        const comando = comandosFiltrados[indicePaletaSeguro]
        if (comando) {
          setEntrada(ENTRADA_VACIA)
          setIndicePaleta(0)
          ejecutarComando(comando.id, '')
        }
        return
      }
    }

    if (key.upArrow && !key.shift) {
      const navegacion = navegarHistorial(
        historialEntradas,
        indiceHistorial,
        borradorHistorial,
        'arriba',
        entrada.buffer,
      )
      setIndiceHistorial(navegacion.indice)
      setBorradorHistorial(navegacion.borrador)
      setEntrada({ buffer: navegacion.texto, cursor: navegacion.texto.length })
      return
    }

    if (key.downArrow && !key.shift) {
      const navegacion = navegarHistorial(
        historialEntradas,
        indiceHistorial,
        borradorHistorial,
        'abajo',
        entrada.buffer,
      )
      setIndiceHistorial(navegacion.indice)
      setBorradorHistorial(navegacion.borrador)
      setEntrada({ buffer: navegacion.texto, cursor: navegacion.texto.length })
      return
    }

    const resultado = aplicarTecla(entrada, input, key)

    if (resultado.tipo === 'cancelar') {
      if (sesion.obtenerEstado().turnoEnCurso) {
        sesion.cancelar()
        setAviso('Cancelando el turno...')
      } else {
        exit()
      }
      return
    }

    if (resultado.tipo === 'salir') {
      exit()
      return
    }

    if (resultado.tipo === 'edicion') {
      if (resultado.estado.buffer !== entrada.buffer) {
        setIndiceHistorial(null)
        setIndicePaleta(0)
      }
      setEntrada(resultado.estado)
      return
    }

    if (resultado.tipo === 'comando') {
      setEntrada(resultado.estado)
      ejecutarComando(resultado.comando, resultado.argumentos)
      return
    }

    if (sesion.obtenerEstado().turnoEnCurso) {
      setAviso('Esperá a que termine el turno para enviar otro pedido.')
      return
    }

    setEntrada(resultado.estado)
    void enviar(resultado.texto)
  })

  usePaste((texto) => {
    setEntrada((actual) => insertarTexto(actual, texto))
    setIndiceHistorial(null)
    setIndicePaleta(0)
  })

  return (
    <Box flexDirection="column">
      <BarraEstado estado={estado} directorio={directorio} />
      <ComponentePromptSistema prompt={estado.promptSistema} />

      <Static items={estado.historial}>
        {(elemento) => (
          <ComponenteElemento key={elemento.id} elemento={elemento} />
        )}
      </Static>

      {estado.textoStreamingActual.length > 0 && (
        <MensajeAsistente texto={estado.textoStreamingActual} enCurso />
      )}

      {estado.herramientaEnCurso && (
        <TarjetaHerramientaEnCurso herramienta={estado.herramientaEnCurso} />
      )}

      {estado.turnoEnCurso &&
        !estado.herramientaEnCurso &&
        estado.textoStreamingActual.length === 0 && (
          <Text color="gray">Pensando…</Text>
        )}

      {panel === 'contexto' && <PanelContexto metricas={estado.contexto} />}
      {panel === 'ayuda' && <PanelAyuda />}

      {selectorModeloAbierto && (
        <SelectorModelo
          modelos={modelosFiltrados}
          seleccionado={indiceModeloSeguro}
          activo={estado.modeloActivo}
          filtro={filtroModelo}
        />
      )}

      {paletaAbierta && (
        <PaletaComandos
          comandos={comandosFiltrados}
          seleccionado={indicePaletaSeguro}
        />
      )}

      {aviso && <Aviso texto={aviso} />}

      <CajaEntrada entrada={entrada} turnoEnCurso={estado.turnoEnCurso} />
      <PieAtajos turnoEnCurso={estado.turnoEnCurso} />
    </Box>
  )
}
