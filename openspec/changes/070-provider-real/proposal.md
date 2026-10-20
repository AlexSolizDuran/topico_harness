# Proposal

## Why

El único provider implementado es `ProveedorSimulado`, que reproduce un guion y
nunca habla con un modelo real. Para que el harness sirva hay que conectar al
menos una API, y la forma de hacerlo determina si agregar la segunda es config o
es reescribir el bucle.

## What Changes

- Adaptador real para APIs compatibles con chat completions de OpenAI (SSE,
  tool calls fragmentados, fin de respuesta y conteo de tokens).
- Parser de SSE compartido, reutilizable por adaptadores futuros.
- Configuración de proveedores y modelos en archivo, con credencial por variable
  de entorno.
- Factory por `tipo` para elegir el adaptador sin `switch` en el bucle.
- Registro de modelos con capacidades: herramientas y ventana de contexto.
- Suite de contrato compartida para que cada adaptador nuevo herede los tests.
- Ningún cambio de comportamiento especificado: se materializan los requisitos
  «interfaz de provider agnóstica» y «los eventos del provider se traducen».

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Este change es `skip_specs`: el contrato ya exige una interfaz agnóstica
y permite dar de alta un proveedor nuevo sin tocar el bucle. La elección del
proveedor concreto y el formato de configuración son decisiones de diseño, no
comportamiento nuevo.

## Impact

- `src/provider/adapters/openai-compatible.ts` (nuevo).
- `src/provider/sse.ts` (nuevo).
- `src/provider/config.ts` (nuevo).
- `src/provider/factory.ts` (nuevo).
- `src/provider/types.ts`: se agrega `modelo` y las capacidades al contrato
  interno del provider.
- `src/provider/index.ts`: exporta lo nuevo.
- `tests/provider/`: suite de contrato y tests con servidor HTTP falso.
- `package.json`: sin dependencias nuevas; se usa `fetch` y `AbortSignal` de Node.
