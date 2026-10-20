import { Box, Text } from 'ink'
import type React from 'react'
import type { MetricasContexto } from '../context/metrics.js'
import type { ComandoUi } from './commands.js'
import type {
  ElementoVisual,
  EstadoSesionVisual,
  HerramientaEnCurso,
} from './state.js'

export function formatearTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return `${tokens}`
}

function formatearValor(valor: unknown): string {
  if (typeof valor === 'string') return valor
  try {
    return JSON.stringify(valor) ?? String(valor)
  } catch {
    return String(valor)
  }
}

export function resumirArgumentos(
  argumentos: Record<string, unknown> | undefined,
): string {
  if (!argumentos) return ''
  const partes = Object.entries(argumentos).map(
    ([clave, valor]) => `${clave}=${formatearValor(valor)}`,
  )
  const resumen = partes.join(' ')
  return resumen.length > 80 ? `${resumen.slice(0, 79)}…` : resumen
}

function acortarRuta(ruta: string): string {
  if (ruta.length <= 42) return ruta
  return `…${ruta.slice(-41)}`
}

export const ComponentePromptSistema: React.FC<{ prompt: string }> = ({
  prompt,
}) => {
  if (!prompt) return null
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="gray">sistema</Text>
      <Text color="gray">{prompt}</Text>
    </Box>
  )
}

export const MensajeUsuario: React.FC<{ texto: string }> = ({ texto }) => (
  <Box marginY={1}>
    <Text bold color="green">
      ›{' '}
    </Text>
    <Text>{texto}</Text>
  </Box>
)

export const MensajeAsistente: React.FC<{
  texto: string
  enCurso?: boolean
}> = ({ texto, enCurso = false }) => (
  <Box marginY={1}>
    {enCurso ? <Text color="cyan">{texto}</Text> : <Text>{texto}</Text>}
    {enCurso ? <Text color="cyan">▌</Text> : null}
  </Box>
)

export const Aviso: React.FC<{ texto: string }> = ({ texto }) => (
  <Box marginY={0}>
    <Text color="yellow">! {texto}</Text>
  </Box>
)

export interface PropsTarjetaHerramienta {
  nombre: string
  argumentos?: Record<string, unknown> | undefined
  resultado?: string | undefined
  esError?: boolean | undefined
  truncado?: boolean | undefined
  enCurso?: boolean | undefined
}

export const TarjetaHerramienta: React.FC<PropsTarjetaHerramienta> = ({
  nombre,
  argumentos,
  resultado,
  esError = false,
  truncado = false,
  enCurso = false,
}) => {
  const resumen = resumirArgumentos(argumentos)
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={esError ? 'red' : enCurso ? 'yellow' : 'gray'}
      paddingX={1}
      marginY={1}
    >
      <Box>
        <Text bold color={esError ? 'red' : enCurso ? 'yellow' : 'cyan'}>
          {enCurso ? '◐' : '●'} {nombre}
        </Text>
        {resumen ? <Text color="gray"> {resumen}</Text> : null}
        {enCurso ? <Text color="yellow"> · en curso</Text> : null}
      </Box>
      {resultado !== undefined ? (
        <Box marginTop={1}>
          {esError ? (
            <Text color="red">{resultado}</Text>
          ) : (
            <Text>{resultado}</Text>
          )}
        </Box>
      ) : null}
      {truncado ? <Text color="yellow">resultado truncado</Text> : null}
    </Box>
  )
}

export const TarjetaHerramientaEnCurso: React.FC<{
  herramienta: HerramientaEnCurso
}> = ({ herramienta }) => (
  <TarjetaHerramienta
    nombre={herramienta.nombre}
    argumentos={herramienta.argumentos}
    enCurso
  />
)

export const ComponenteElemento: React.FC<{ elemento: ElementoVisual }> = ({
  elemento,
}) => {
  if (elemento.tipo === 'usuario') {
    return <MensajeUsuario texto={elemento.texto} />
  }

  if (elemento.tipo === 'asistente') {
    return <MensajeAsistente texto={elemento.texto} />
  }

  if (elemento.tipo === 'herramienta') {
    return (
      <TarjetaHerramienta
        nombre={elemento.nombre}
        argumentos={elemento.argumentos}
        resultado={elemento.resultado}
        esError={elemento.esError}
        truncado={elemento.truncado}
      />
    )
  }

  return <Aviso texto={elemento.texto} />
}

export interface PropsBarraEstado {
  estado: EstadoSesionVisual
  directorio?: string | undefined
}

export const BarraEstado: React.FC<PropsBarraEstado> = ({
  estado,
  directorio,
}) => {
  const contexto = estado.contexto
  const uso = `${formatearTokens(contexto.tokensActuales)}/${formatearTokens(
    contexto.limitePresupuesto,
  )}`
  const porcentaje = Math.round(contexto.porcentajeUso)
  return (
    <Box
      borderStyle="single"
      borderColor="gray"
      justifyContent="space-between"
      paddingX={1}
    >
      <Text bold color="cyan">
        ◆ {estado.modeloActivo || 'sin modelo'}
      </Text>
      {directorio ? (
        <Text color="gray" wrap="truncate">
          {acortarRuta(directorio)}
        </Text>
      ) : null}
      <Text color={estado.turnoEnCurso ? 'yellow' : 'green'}>
        {estado.turnoEnCurso ? 'trabajando' : 'listo'} · {uso} ({porcentaje}%
        {contexto.esEstimado ? ' est.' : ''})
      </Text>
    </Box>
  )
}

export const PanelContexto: React.FC<{ metricas: MetricasContexto }> = ({
  metricas,
}) => {
  const compactacion = metricas.ultimaCompactacion
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginY={1}
    >
      <Text bold color="cyan">
        Contexto
      </Text>
      <Text>
        Ventana total: {formatearTokens(metricas.ventanaContexto)} tokens
      </Text>
      <Text>
        Presupuesto: {formatearTokens(metricas.limitePresupuesto)} tokens ·
        margen {formatearTokens(metricas.margenReservado)}
      </Text>
      <Text>
        Uso actual: {formatearTokens(metricas.tokensActuales)} tokens (
        {Math.round(metricas.porcentajeUso)}%
        {metricas.esEstimado ? ', estimado' : ', exacto'})
      </Text>
      <Text>Disponible: {formatearTokens(metricas.disponible)} tokens</Text>
      <Text>Mensajes: {metricas.mensajes}</Text>
      <Text>
        Consumo acumulado: {formatearTokens(metricas.tokensAcumulados)} tokens
      </Text>
      {compactacion ? (
        <Text>
          Última compactación: {formatearTokens(compactacion.antesTokens)} →{' '}
          {formatearTokens(compactacion.despuesTokens)} tokens (
          {compactacion.antesMensajes} → {compactacion.despuesMensajes}{' '}
          mensajes)
        </Text>
      ) : (
        <Text color="gray">Última compactación: ninguna</Text>
      )}
      <Text color="gray">Esc cierra este panel</Text>
    </Box>
  )
}

export const PanelAyuda: React.FC = () => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="cyan">
      Ayuda
    </Text>
    <Text>Enter enviar · Shift+Enter nueva línea · Ctrl+J alternativa</Text>
    <Text>↑/↓ historial de pedidos · / abre la paleta de comandos</Text>
    <Text>Ctrl+C cancela el turno o cierra · Ctrl+D cierra</Text>
    <Text>/modelo elige el modelo · /contexto muestra el uso</Text>
    <Text color="gray">Esc cierra este panel</Text>
  </Box>
)

export const PaletaComandos: React.FC<{
  comandos: readonly ComandoUi[]
  seleccionado: number
}> = ({ comandos, seleccionado }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="cyan">
      Comandos
    </Text>
    {comandos.length === 0 ? (
      <Text color="gray">Sin coincidencias</Text>
    ) : (
      comandos.map((comando, indice) => (
        <Text
          key={comando.id}
          color={indice === seleccionado ? 'cyan' : 'white'}
          inverse={indice === seleccionado}
        >
          {indice === seleccionado ? '›' : ' '} {comando.etiqueta}{' '}
          <Text color="gray">{comando.descripcion}</Text>
        </Text>
      ))
    )}
    <Text color="gray">↑/↓ elegir · Enter ejecutar · Esc cerrar</Text>
  </Box>
)

export const SelectorModelo: React.FC<{
  modelos: string[]
  seleccionado: number
  activo: string
  filtro: string
}> = ({ modelos, seleccionado, activo, filtro }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="magenta"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="magenta">
      Modelo
    </Text>
    <Text color="gray">Filtro: {filtro || '(todos)'}</Text>
    {modelos.length === 0 ? (
      <Text color="gray">Sin coincidencias</Text>
    ) : (
      modelos.map((modelo, indice) => (
        <Text
          key={modelo}
          color={indice === seleccionado ? 'magenta' : 'white'}
          inverse={indice === seleccionado}
        >
          {indice === seleccionado ? '›' : ' '} {modelo === activo ? '●' : '○'}{' '}
          {modelo}
        </Text>
      ))
    )}
    <Text color="gray">↑/↓ elegir · Enter cambiar · Esc cerrar</Text>
  </Box>
)

export const CajaEntrada: React.FC<{
  entrada: { buffer: string; cursor: number }
  turnoEnCurso: boolean
}> = ({ entrada, turnoEnCurso }) => {
  const lineas = entrada.buffer.split('\n')
  const antesDelCursor = entrada.buffer.slice(0, entrada.cursor).split('\n')
  const lineaCursor = antesDelCursor.length - 1
  const columna = antesDelCursor[lineaCursor]?.length ?? 0
  let desplazamiento = 0
  const lineasConClave = lineas.map((linea) => {
    const clave = `linea-${desplazamiento}`
    desplazamiento += linea.length + 1
    return { linea, clave }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={turnoEnCurso ? 'gray' : 'green'}
      paddingX={1}
      marginTop={1}
    >
      {lineasConClave.map(({ linea, clave }, indice) => {
        const prefijo = indice === 0 ? '› ' : '  '
        if (indice !== lineaCursor) {
          return (
            <Text key={clave} color={turnoEnCurso ? 'gray' : 'green'}>
              {prefijo}
              {linea}
            </Text>
          )
        }
        const antes = linea.slice(0, columna)
        const caracter = linea.slice(columna, columna + 1) || ' '
        const despues = linea.slice(columna + 1)
        return (
          <Text key={clave} color={turnoEnCurso ? 'gray' : 'green'}>
            {prefijo}
            {antes}
            <Text backgroundColor="white" color="black">
              {caracter}
            </Text>
            {despues}
          </Text>
        )
      })}
    </Box>
  )
}

export const PieAtajos: React.FC<{ turnoEnCurso: boolean }> = ({
  turnoEnCurso,
}) => (
  <Text color="gray">
    {turnoEnCurso
      ? 'Ctrl+C cancela el turno · esperá a que termine para enviar otro pedido'
      : 'Enter envía · Shift+Enter nueva línea · ↑/↓ historial · / comandos · Ctrl+D sale'}
  </Text>
)

export const AppHarness: React.FC<{ estado: EstadoSesionVisual }> = ({
  estado,
}) => {
  return (
    <Box flexDirection="column" padding={1}>
      <BarraEstado estado={estado} />
      <ComponentePromptSistema prompt={estado.promptSistema} />

      {estado.historial.map((elem) => (
        <ComponenteElemento key={elem.id} elemento={elem} />
      ))}

      {estado.textoStreamingActual.length > 0 && (
        <MensajeAsistente texto={estado.textoStreamingActual} enCurso />
      )}

      {estado.herramientaEnCurso && (
        <TarjetaHerramientaEnCurso herramienta={estado.herramientaEnCurso} />
      )}

      {estado.turnoEnCurso && !estado.herramientaEnCurso && (
        <Text color="gray">Pensando…</Text>
      )}
    </Box>
  )
}
