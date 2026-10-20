import { Box, Text } from 'ink'
import type React from 'react'
import type { ElementoVisual, EstadoSesionVisual } from './state.js'

export const ComponentePromptSistema: React.FC<{ prompt: string }> = ({
  prompt,
}) => {
  if (!prompt) return null
  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1} marginBottom={1}>
      <Text bold color="blue">
        [Sistema]:{' '}
      </Text>
      <Text>{prompt}</Text>
    </Box>
  )
}

export const ComponenteElemento: React.FC<{ elemento: ElementoVisual }> = ({
  elemento,
}) => {
  if (elemento.tipo === 'usuario') {
    return (
      <Box marginY={0}>
        <Text bold color="green">
          [Usuario]:{' '}
        </Text>
        <Text>{elemento.texto}</Text>
      </Box>
    )
  }

  if (elemento.tipo === 'asistente') {
    return (
      <Box marginY={0}>
        <Text bold color="cyan">
          [Asistente]:{' '}
        </Text>
        <Text>{elemento.texto}</Text>
      </Box>
    )
  }

  if (elemento.tipo === 'herramienta') {
    return (
      <Box marginY={0} paddingLeft={2}>
        <Text bold color={elemento.esError ? 'red' : 'yellow'}>
          [Herramienta: {elemento.nombre}
          {elemento.esError ? ' (ERROR)' : ''}
          {elemento.truncado ? ' (TRUNCADO)' : ''}]:{' '}
        </Text>
        <Text>{elemento.resultado}</Text>
      </Box>
    )
  }

  return (
    <Box marginY={0}>
      <Text color="gray">[Aviso]: {elemento.texto}</Text>
    </Box>
  )
}

export const AppHarness: React.FC<{ estado: EstadoSesionVisual }> = ({
  estado,
}) => {
  return (
    <Box flexDirection="column" padding={1}>
      {/* 1. Prompt del sistema siempre visible */}
      <ComponentePromptSistema prompt={estado.promptSistema} />

      {/* 2. Historial acumulado */}
      {estado.historial.map((elem) => (
        <ComponenteElemento key={elem.id} elemento={elem} />
      ))}

      {/* 3. Streaming en curso */}
      {estado.textoStreamingActual.length > 0 && (
        <Box marginY={0}>
          <Text bold color="cyan">
            [Asistente]:{' '}
          </Text>
          <Text>{estado.textoStreamingActual}</Text>
        </Box>
      )}

      {/* 4. Estado de actividad */}
      {estado.turnoEnCurso && (
        <Box marginTop={1}>
          <Text color="gray">Pensando...</Text>
        </Box>
      )}
    </Box>
  )
}
