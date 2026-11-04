import { basename } from 'node:path'
import { Box, Text } from 'ink'
import type React from 'react'
import type { DefinicionAgente } from '../agents/definiciones.js'
import type { MetricasContexto } from '../context/metrics.js'
import type {
  ResultadoBusquedaSesion,
  SesionMetadata,
} from '../sesiones/index.js'
import type { SolicitudAprobacion } from '../types.js'
import type { ComandoUi } from './commands.js'
import type {
  ElementoVisual,
  EstadoSesionVisual,
  EstadoSkillVisual,
  HerramientaEnCurso,
  SkillOmitidaVisual,
} from './state.js'

export function formatearTokens(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`
  }
  return `${tokens}`
}

/**
 * Variante para la barra de estado: evita el ".0" que ocupa espacio sin aportar
 * información cuando el número es redondo.
 */
export function formatearTokensCompacto(tokens: number): string {
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1).replace(/\.0$/, '')}k`
  }
  return `${tokens}`
}

export type ColorUsoTokens = 'red' | 'yellow' | 'green' | 'gray'

export interface UsoTokensVisual {
  porcentaje: number
  porcentajeLibre: number
  color: ColorUsoTokens
  relleno: number
}

/**
 * El color se decide por lo que queda, no por lo consumido: verde mientras haya
 * margen cómodo, amarillo cuando el margen se acorta y rojo cuando el próximo
 * turno puede quedar sin espacio.
 */
export function calcularUsoTokens(
  usados: number,
  limite: number,
): UsoTokensVisual {
  if (limite <= 0) {
    return { porcentaje: 0, porcentajeLibre: 100, color: 'gray', relleno: 0 }
  }

  const porcentaje = Math.min(100, Math.round((usados / limite) * 100))
  const porcentajeLibre = Math.max(0, 100 - porcentaje)
  const color: ColorUsoTokens =
    porcentajeLibre <= 10 ? 'red' : porcentajeLibre <= 30 ? 'yellow' : 'green'
  const relleno = Math.min(10, Math.max(0, Math.round((usados / limite) * 10)))

  return { porcentaje, porcentajeLibre, color, relleno }
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

export const MensajeUsuario: React.FC<{ texto: string }> = ({ texto }) => (
  <Box flexDirection="column" marginY={1}>
    <Text bold color="green">
      ● usuario
    </Text>
    <Text>{texto}</Text>
  </Box>
)

export const MensajeAsistente: React.FC<{
  texto: string
  enCurso?: boolean
}> = ({ texto, enCurso = false }) => (
  <Box flexDirection="column" marginY={1}>
    <Text bold color={enCurso ? 'yellow' : 'cyan'}>
      ● {enCurso ? 'modelo · escribiendo…' : 'modelo'}
    </Text>
    <Text color={enCurso ? 'cyan' : 'white'}>
      {texto}
      {enCurso ? '▌' : ''}
    </Text>
  </Box>
)

export const Aviso: React.FC<{ texto: string }> = ({ texto }) => (
  <Box marginY={0}>
    <Text color="yellow">⚠ {texto}</Text>
  </Box>
)

export interface PropsTarjetaHerramienta {
  nombre: string
  argumentos?: Record<string, unknown> | undefined
  resultado?: string | undefined
  salidaCompleta?: string | undefined
  esError?: boolean | undefined
  truncado?: boolean | undefined
  esCola?: boolean | undefined
  enCurso?: boolean | undefined
}

export const TarjetaHerramienta: React.FC<PropsTarjetaHerramienta> = ({
  nombre,
  argumentos,
  resultado,
  salidaCompleta,
  esError = false,
  truncado = false,
  esCola = false,
  enCurso = false,
}) => {
  const resumen = resumirArgumentos(argumentos)
  const contenidoAMostrar = salidaCompleta ?? resultado
  const tieneCola =
    esCola || (salidaCompleta !== undefined && salidaCompleta !== resultado)

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
      {contenidoAMostrar !== undefined ? (
        <Box marginTop={1}>
          {esError ? (
            <Text color="red">{contenidoAMostrar}</Text>
          ) : (
            <Text>{contenidoAMostrar}</Text>
          )}
        </Box>
      ) : null}
      {tieneCola ? (
        <Text color="cyan">
          [Cola entregada al modelo; la interfaz conserva la salida completa]
        </Text>
      ) : truncado ? (
        <Text color="yellow">resultado truncado</Text>
      ) : null}
    </Box>
  )
}

export interface PropsTarjetaDelegacion {
  subagente: string
  pedido: string
  resultado?: string | undefined
  esError?: boolean | undefined
  truncado?: boolean | undefined
  enCurso?: boolean | undefined
}

export const TarjetaDelegacion: React.FC<PropsTarjetaDelegacion> = ({
  subagente,
  pedido,
  resultado,
  esError = false,
  truncado = false,
  enCurso = false,
}) => (
  <Box
    flexDirection="column"
    borderStyle="double"
    borderColor={esError ? 'red' : enCurso ? 'magenta' : 'blue'}
    paddingX={1}
    marginY={1}
  >
    <Box>
      <Text bold color={esError ? 'red' : 'magenta'}>
        {enCurso ? '◈' : '◆'} subagente: {subagente}
      </Text>
      {enCurso ? <Text color="yellow"> · investigando</Text> : null}
    </Box>
    {pedido ? <Text color="gray">pedido: {pedido}</Text> : null}
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

export const TarjetaHerramientaEnCurso: React.FC<{
  herramienta: HerramientaEnCurso
}> = ({ herramienta }) => {
  const enCurso = !herramienta.completada
  if (herramienta.nombre === 'task') {
    return (
      <TarjetaDelegacion
        subagente={String(herramienta.argumentos.agent ?? 'subagente')}
        pedido={String(herramienta.argumentos.prompt ?? '')}
        resultado={herramienta.resultado}
        esError={herramienta.esError}
        truncado={herramienta.truncado}
        enCurso={enCurso}
      />
    )
  }

  return (
    <TarjetaHerramienta
      nombre={herramienta.nombre}
      argumentos={herramienta.argumentos}
      resultado={herramienta.resultado}
      salidaCompleta={herramienta.salidaCompleta}
      esError={herramienta.esError}
      truncado={herramienta.truncado}
      esCola={herramienta.esCola}
      enCurso={enCurso}
    />
  )
}

export const ComponenteElemento: React.FC<{ elemento: ElementoVisual }> = ({
  elemento,
}) => {
  if (elemento.tipo === 'usuario') {
    return <MensajeUsuario texto={elemento.texto} />
  }

  if (elemento.tipo === 'asistente') {
    return <MensajeAsistente texto={elemento.texto} />
  }

  if (elemento.tipo === 'delegacion') {
    return (
      <TarjetaDelegacion
        subagente={elemento.subagente}
        pedido={elemento.pedido}
        resultado={elemento.resultado}
        esError={elemento.esError}
        truncado={elemento.truncado}
      />
    )
  }

  if (elemento.tipo === 'herramienta') {
    return (
      <TarjetaHerramienta
        nombre={elemento.nombre}
        argumentos={elemento.argumentos}
        resultado={elemento.resultado}
        salidaCompleta={elemento.salidaCompleta}
        esError={elemento.esError}
        truncado={elemento.truncado}
        esCola={elemento.esCola}
      />
    )
  }

  return <Aviso texto={elemento.texto} />
}

export const Cabecera: React.FC<{
  directorio?: string | undefined
  sesionId?: string | undefined
  tareasBackground?: number | undefined
}> = ({ directorio, sesionId, tareasBackground = 0 }) => {
  const proyecto = directorio ? basename(directorio) : ''
  const secundaria = [
    sesionId ? `ses ${sesionId}` : '',
    tareasBackground > 0 ? `${tareasBackground} bg` : '',
  ]
    .filter((parte) => parte.length > 0)
    .join(' · ')
  return (
    <Box paddingX={1} marginBottom={1}>
      <Text>
        <Text bold color="cyan">
          ◆ harness
        </Text>
        <Text color="gray"> · {proyecto || 'tu agente en la terminal'}</Text>
        {secundaria ? <Text color="gray"> · {secundaria}</Text> : null}
      </Text>
    </Box>
  )
}

export interface PropsBarraEstado {
  estado: EstadoSesionVisual
}

export const BarraEstado: React.FC<PropsBarraEstado> = ({ estado }) => {
  const contexto = estado.contexto
  const usados = contexto.tokensActuales
  const limite = contexto.limitePresupuesto
  const uso = `${formatearTokensCompacto(usados)}/${formatearTokensCompacto(limite)}`
  const { porcentaje, color, relleno } = calcularUsoTokens(usados, limite)
  const barraLlena = '█'.repeat(relleno)
  const barraVacia = '░'.repeat(10 - relleno)
  const modelo = estado.modeloActivo || 'sin modelo'
  const etiquetaEstado = estado.esperandoAprobacion
    ? 'esperando aprobación'
    : estado.turnoEnCurso
      ? 'trabajando'
      : 'listo'
  const colorEstado =
    estado.esperandoAprobacion || estado.turnoEnCurso ? 'yellow' : 'green'

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
    >
      <Box justifyContent="space-between" width="100%">
        <Text wrap="truncate">
          <Text bold color="cyan">
            modelo:{' '}
          </Text>
          <Text bold>{modelo}</Text>
        </Text>
        <Box>
          <Text bold color={color}>
            {uso} Tokens ({porcentaje}%)
          </Text>
          {contexto.esEstimado ? <Text color="gray"> est.</Text> : null}
          <Text> </Text>
          <Text color={color}>{barraLlena}</Text>
          <Text color="gray">{barraVacia}</Text>
        </Box>
      </Box>
      <Box width="100%">
        <Text color={colorEstado}>● {etiquetaEstado}</Text>
      </Box>
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
      {metricas.tokensSkills !== undefined && metricas.tokensSkills > 0 ? (
        <Text>
          Catálogo de skills: {formatearTokens(metricas.tokensSkills)} tokens
        </Text>
      ) : null}
      {metricas.etapaAplicada && metricas.etapaAplicada !== 'ninguna' ? (
        <Text>
          Etapa aplicada: {metricas.etapaAplicada}
          {metricas.tokensRecuperados !== undefined &&
          metricas.tokensRecuperados > 0
            ? ` (${formatearTokens(metricas.tokensRecuperados)} tokens recuperados)`
            : ''}
        </Text>
      ) : null}
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

function ListaSesiones({
  sesiones,
  activa,
}: {
  sesiones: readonly SesionMetadata[]
  activa?: string | undefined
}): React.JSX.Element {
  if (sesiones.length === 0) {
    return <Text dimColor>No hay sesiones guardadas en este proyecto.</Text>
  }
  return (
    <>
      {sesiones.map((sesion) => (
        <Text key={sesion.id}>
          {sesion.id === activa ? '●' : '○'} {sesion.id} ·{' '}
          {sesion.actualizadaEn.slice(0, 16).replace('T', ' ')} ·{' '}
          {sesion.modelo || 'sin modelo'} · {sesion.mensajes} mensajes
        </Text>
      ))}
    </>
  )
}

function ListaResultados({
  resultados,
  activa,
}: {
  resultados: readonly ResultadoBusquedaSesion[]
  activa?: string | undefined
}): React.JSX.Element {
  if (resultados.length === 0) {
    return <Text dimColor>Sin coincidencias.</Text>
  }
  return (
    <>
      {resultados.map((resultado) => (
        <Text key={resultado.sesion.id}>
          {resultado.sesion.id === activa ? '●' : '○'} {resultado.sesion.id} ·{' '}
          {resultado.coincidencias} coincidencia(s) · {resultado.fragmento}
        </Text>
      ))}
    </>
  )
}

export const PanelSesiones: React.FC<{
  sesiones: readonly SesionMetadata[]
  activa?: string | undefined
  titulo?: string | undefined
  resultados?: readonly ResultadoBusquedaSesion[] | undefined
}> = ({ sesiones, activa, titulo = 'Sesiones guardadas', resultados }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
  >
    <Text bold color="cyan">
      {titulo}
    </Text>
    {resultados ? (
      <ListaResultados resultados={resultados} activa={activa} />
    ) : (
      <ListaSesiones sesiones={sesiones} activa={activa} />
    )}
    <Text dimColor>
      {resultados
        ? 'Esc para cerrar'
        : '/sesiones <id> para reanudar · Esc para cerrar'}
    </Text>
  </Box>
)

export const PanelSkills: React.FC<{
  skills?: readonly EstadoSkillVisual[] | undefined
  omitidas?: readonly SkillOmitidaVisual[] | undefined
}> = ({ skills = [], omitidas = [] }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="cyan"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="cyan">
      Skills
    </Text>
    {skills.length === 0 ? (
      <>
        <Text color="gray">Sin skills descubiertas</Text>
        <Text color="gray">
          Colocá .opencode/skills/&lt;id&gt;/SKILL.md o
          .opencode/skills/&lt;id&gt;.md
        </Text>
      </>
    ) : (
      skills.map((skill) => (
        <Text key={skill.id}>
          <Text bold>skill:{skill.id}</Text> · {skill.nombre} ·{' '}
          <Text color={skill.cargada ? 'green' : 'yellow'}>
            {skill.cargada ? 'cargada' : 'disponible'}
          </Text>{' '}
          · <Text color="gray">{skill.descripcion}</Text>
        </Text>
      ))
    )}
    {omitidas.length > 0 ? (
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">
          Skills omitidas
        </Text>
        {omitidas.map((om) => (
          <Text key={om.id} color="yellow">
            ! {om.id}: {om.motivo}
          </Text>
        ))}
      </Box>
    ) : null}
    <Text color="gray">Esc cierra este panel</Text>
  </Box>
)

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
    <Text>Enter enviar · Shift+Enter nueva línea · Tab cambiar agente</Text>
    <Text>↑/↓ historial de pedidos · / abre la paleta de comandos</Text>
    <Text>Ctrl+C cancela el turno o cierra · Ctrl+D cierra</Text>
    <Text>
      /agente elige el agente · /modelo elige el modelo · /contexto muestra el
      uso · /skills ver catálogo
    </Text>
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

export const SelectorAgente: React.FC<{
  agentes: readonly DefinicionAgente[]
  seleccionado: number
  activo: string
}> = ({ agentes, seleccionado, activo }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="green"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="green">
      Agente
    </Text>
    {agentes.length === 0 ? (
      <Text color="gray">Sin agentes primarios</Text>
    ) : (
      agentes.map((agente, indice) => (
        <Text
          key={agente.nombre}
          color={indice === seleccionado ? 'green' : 'white'}
          inverse={indice === seleccionado}
        >
          {indice === seleccionado ? '›' : ' '}{' '}
          {agente.nombre === activo ? '●' : '○'} {agente.nombre}{' '}
          <Text color="gray">{agente.descripcion}</Text>
        </Text>
      ))
    )}
    <Text color="gray">↑/↓ elegir · Enter activar · Esc cerrar</Text>
  </Box>
)

export const PanelAprobacion: React.FC<{
  solicitud: SolicitudAprobacion
}> = ({ solicitud }) => (
  <Box
    flexDirection="column"
    borderStyle="round"
    borderColor="yellow"
    paddingX={1}
    marginY={1}
  >
    <Text bold color="yellow">
      Aprobación requerida
    </Text>
    <Text>
      Acción: <Text bold>{solicitud.accion}</Text> · Recurso:{' '}
      <Text bold>{solicitud.recurso}</Text>
    </Text>
    {solicitud.motivo ? (
      <Text color="red">Motivo: {solicitud.motivo}</Text>
    ) : null}
    {solicitud.obligatoria ? (
      <>
        <Text color="gray">
          Esta operación siempre requiere aprobación; no se puede guardar.
        </Text>
        <Text>[1 / y] Aprobar una vez · [3 / n / Esc] Denegar</Text>
      </>
    ) : (
      <>
        <Text color="gray">Patrón sugerido: {solicitud.patronSugerido}</Text>
        <Text>
          [1 / y] Aprobar una vez · [2 / a] Aprobar siempre · [3 / n / Esc]
          Denegar
        </Text>
      </>
    )}
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

  if (entrada.buffer.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={turnoEnCurso ? 'gray' : 'green'}
        paddingX={1}
        marginTop={1}
      >
        <Text color="gray">
          {turnoEnCurso ? '⏳ esperando al modelo…' : '› Escribí tu pedido…'}
        </Text>
      </Box>
    )
  }

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
      : 'Enter envía · Shift+Enter nueva línea · Tab agente · ↑/↓ historial · / comandos · Ctrl+D sale'}
  </Text>
)

export const AppHarness: React.FC<{ estado: EstadoSesionVisual }> = ({
  estado,
}) => {
  const tarjetasActivas =
    estado.herramientasEnCurso && estado.herramientasEnCurso.length > 0
      ? estado.herramientasEnCurso
      : estado.herramientaEnCurso
        ? [estado.herramientaEnCurso]
        : []

  return (
    <Box flexDirection="column" padding={1}>
      <Cabecera />

      {estado.historial.map((elem) => (
        <ComponenteElemento key={elem.id} elemento={elem} />
      ))}

      {estado.textoStreamingActual.length > 0 && (
        <MensajeAsistente texto={estado.textoStreamingActual} enCurso />
      )}

      {tarjetasActivas.map((herramienta) => (
        <TarjetaHerramientaEnCurso
          key={herramienta.id}
          herramienta={herramienta}
        />
      ))}

      {estado.aprobacionPendiente && (
        <PanelAprobacion solicitud={estado.aprobacionPendiente} />
      )}

      {estado.turnoEnCurso &&
        tarjetasActivas.length === 0 &&
        !estado.aprobacionPendiente && <Text color="gray">Pensando…</Text>}

      <BarraEstado estado={estado} />
    </Box>
  )
}
