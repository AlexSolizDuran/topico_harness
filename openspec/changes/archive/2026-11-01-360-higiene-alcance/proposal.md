# Proposal

## Why

Después de especificar los restos del Nivel 6 y las capacidades de los niveles 7
y 8, la documentación del proyecto queda desactualizada: `AGENTS.md` y
`openspec/config.yaml` siguen diciendo 12 capacidades y declaran sandbox, LSP,
MCP y memoria fuera de alcance; `alcance/README.md` habla de 9 capacidades y
`alcance/plan-implementacion.md` de una v1 de 4.

Además, el flujo del repo solo documenta changes de implementación con
`skip_specs: true`. Ahora también existen changes de spec, que introducen
requisitos y no llevan ese marcador. Sin esa distinción, el próximo change puede
elegir el modo equivocado.

## What Changes

- Actualizar `openspec/config.yaml`: capacidades, requisitos, escenarios, estado
  “especificado” vs “implementado” y la lista de pendientes de implementación.
- Actualizar la tabla de capacidades y la sección de alcance de `AGENTS.md`.
- Corregir `alcance/README.md` y `alcance/plan-implementacion.md` donde
  contradicen el contrato actual.
- Actualizar `PREGUNTAS.md` con las decisiones de esta tanda: memoria de
  proyecto/usuario, sandbox con degradación visible en Windows, worktrees
  diferidos y plugins diferidos.
- Documentar las dos clases de change: **spec** (sin `skip_specs`, con delta) e
  **implementación** (`skip_specs: true`, contra specs existentes).
- No tocar `docs/comportamiento.md`: describe comportamiento implementado y las
  capacidades nuevas todavía no lo están.
- Fuera de alcance: implementar las capacidades nuevas, actualizar `src/` o
  `tests/`, y reescribir el razonamiento de `alcance/`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

Ninguna. Es un change de documentación con `skip_specs: true`.

## Impact

- Solo documentación: `openspec/config.yaml`, `AGENTS.md`, `alcance/README.md`,
  `alcance/plan-implementacion.md` y `PREGUNTAS.md`.
- Sin cambios en `openspec/specs/`, `src/` ni `tests/`.
- Depende de que los changes `315`, `320`, `330`, `340` y `350` ya estén
  sincronizados y archivados para que los conteos sean correctos.
