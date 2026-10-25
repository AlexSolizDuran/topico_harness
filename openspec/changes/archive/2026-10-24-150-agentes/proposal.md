# Proposal

## Why

El harness tiene un solo perfil de agente: siempre las mismas herramientas, sin
forma de pedir "analizá pero no toques nada". Restringir por prompt no sirve; el
modelo puede ignorarlo. La única restricción que sostiene es la que no existe en
su lista de herramientas.

Además, el registro de herramientas ya es un dato pero el perfil no. Mientras el
perfil viva en el código, los subagentes del change siguiente y los permisos por
agente van a exigir reescribir el bucle.

## What Changes

- Definir los agentes como datos: nombre, descripción, modo, herramientas y prompt
  propio, en un archivo del proyecto.
- Ofrecer sin configuración un agente completo y uno de solo lectura.
- Filtrar el registro de herramientas por agente: la herramienta que no se declara
  no viaja en la petición y tampoco se puede ejecutar.
- Mantener un agente activo por sesión, cambiarlo de forma atómica y conservar el
  historial y el modelo.
- Mostrar el agente activo y permitir cambiarlo con un atajo o desde una lista.
- Fallar al arrancar ante una definición inválida, en vez de ignorarla.

## Capabilities

### New Capabilities

- `agents`: definiciones declarativas, modos de invocación, restricción de
  herramientas por definición y agente activo por sesión.

### Modified Capabilities

- `interface`: la barra de estado muestra el agente activo y se agrega la elección
  del agente por atajo y por lista.

## Impact

- `openspec/specs/agents/spec.md` (nuevo).
- `src/agents/` (nuevo): definiciones, defaults y carga.
- `src/core/registry.ts`: filtrado por subconjunto sin mutar el catálogo.
- `src/interface/runner.ts`: agente activo, cambio atómico y prompt efectivo.
- `src/interface/state.ts`, `app.tsx`, `app-interactiva.tsx`, `commands.ts`.
- `src/app.ts`, `src/args.ts`, `src/main.ts`.
- `.harness/agents.json` y la excepción en `.gitignore`.
- `tests/agents/` y `tests/interface/agente.test.ts`.
