# Proposal

## Why

El repositorio tiene las cinco capacidades implementadas como biblioteca, pero no
hay forma de arrancarla: `src/index.ts` solo re-exporta, no existe un punto de
entrada, y nadie construye la combinación de catálogo, provider y sesión. Sin un
arranque real, el harness no se puede usar ni verificar de punta a punta.

## What Changes

- Agregar un punto de entrada ejecutable que opera sobre el directorio actual.
- Ensamblar catálogo de herramientas, provider y sesión en un solo lugar.
- Aceptar un pedido inicial por argumentos; sin argumentos, quedar a la espera.
- Resolver el directorio del proyecto por flag (`--dir`) o por el directorio de
  invocación.
- Degradar a salida línea a línea cuando no hay terminal interactiva.
- Agregar los scripts de desarrollo, build y arranque, y el `bin` para instalar
  el comando de terminal.
- Agregar un requisito nuevo a `interface`: el arranque desde la terminal.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `interface`: se agrega el requisito «El harness se inicia desde la terminal
  sobre el proyecto actual», con tres escenarios. El resto de los requisitos de
  la capacidad no cambia.

## Impact

- `src/main.ts` (nuevo), `src/index.ts` sin cambios.
- `package.json`: `bin`, `dev`, `build`, `start`, `tsx` como devDependency.
- `tsconfig.build.json` (nuevo); `tsconfig.json` no cambia.
- `tests/interface/` suma los tests de los tres escenarios nuevos y un test de
  integración del arranque.
- `openspec/config.yaml` y `AGENTS.md`: dejar de afirmar que el repositorio no
  tiene código y actualizar el conteo de requisitos y escenarios.
