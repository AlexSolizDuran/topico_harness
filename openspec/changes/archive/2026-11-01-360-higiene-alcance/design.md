# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `openspec/config.yaml` declara 12 capacidades, 139 requisitos y 463 escenarios,
  y afirma que sandbox, LSP, MCP y memoria están fuera de alcance.
- `AGENTS.md` repite esos conteos y esa exclusión.
- `alcance/README.md` dice que el contrato tiene 9 capacidades.
- `alcance/plan-implementacion.md` describe una v1 de 4 capacidades y niveles 0-3.
- `PREGUNTAS.md` no tiene las decisiones de esta tanda.
- `docs/comportamiento.md` describe lo implementado; las capacidades nuevas todavía
  no tienen código.

## Goals / Non-Goals

**Goals:**

- Que la documentación diga la verdad sobre qué está especificado y qué está
  implementado.
- Que el próximo change sepa si debe llevar `skip_specs` o no.
- Que las decisiones de alcance queden registradas antes de implementar.

**Non-Goals:**

- Implementar las capacidades nuevas.
- Cambiar el contrato de `openspec/specs/`: eso lo hacen los changes 315-350.
- Reescribir el razonamiento de `alcance/`; solo se corrigen las contradicciones.
- Actualizar `docs/comportamiento.md` con comportamiento que todavía no existe.

## Decisions

**Separar “especificado” de “implementado”.** El repo puede tener specs adelante
del código. Decir “implementado” cuando solo hay contrato es la mentira más caras
para el próximo agente. La tabla muestra ambos estados.

**Un change de spec no lleva `skip_specs`.** Introduce requisitos nuevos y su
delta es la razón de ser. Un change de implementación materializa requisitos que
ya existen y por eso lleva `skip_specs: true`. La distinción se documenta en
`AGENTS.md` y `openspec/config.yaml`.

**Los conteos salen de los specs sincronizados.** No se estiman a mano: se
cuentan después de sincronizar 315-350. Si un número no coincide, manda el spec.

**`docs/comportamiento.md` se actualiza con la implementación, no con el spec.**
Ese documento describe lo que el harness hace hoy; adelantarlo confundiría a quien
depure.

**Las decisiones de alcance se registran en `PREGUNTAS.md`.** Memoria de proyecto
por defecto, usuario opcional; sandbox con degradación visible en Windows;
worktrees y plugins diferidos. Así no se reabren en cada change.

## Risks / Trade-offs

- [Los conteos cambian si se agrega otro change] → Se recalculan al archivar; el
  spec es la fuente de verdad.
- [La documentación de alcance y el contrato se vuelven a separar] → Se corrigen
  solo las contradicciones y se deja claro que el spec manda.
- [Marcar capacidades como especificadas pero no implementadas confunde] → La
  tabla tiene una columna de estado explícita.

## Migration Plan

No hay migración. Es documentación. Para volver atrás alcanza con descartar el
change.
