# Design

## Context

El código ya implementa las tres piezas que este change especifica:

- `src/tools/skill.ts` declara la acción `skill` y `src/hooks/ejecutar.ts` declara
  la acción `hook`. Los specs de `skills` y `hooks` ya las usan.
- `src/agents/definiciones.ts` acepta un campo `permisos` y lo valida. El spec de
  `permissions` ya describe el merge de reglas globales y de agente.
- `src/interface/commands.ts` registra `/skills`, `src/interface/app.tsx` expone
  `PanelSkills` y la TUI abre el panel.

Lo que falta es el contrato. `permissions` enumera las acciones y no incluye
`skill` ni `hook`; `agents` no declara el campo `permisos`; `interface` no tiene
un requisito para el panel.

## Goals / Non-Goals

**Goals:**

- Que el catálogo de acciones sea la lista completa de lo que el motor evalúa.
- Que el perfil de agente declare sus permisos como cualquier otro dato.
- Que el panel `/skills` tenga un requisito verificable en la interfaz.
- Que el change sea puramente de specs, sin cambiar comportamiento.

**Non-Goals:**

- Endurecer `normalizarAccionPermiso`: hoy una acción desconocida cae en `read`.
  Es un problema real, pero cambiarlo modifica comportamiento y necesita su
  propio spec y sus tests.
- Agregar tests o tocar código de producción.
- Cambiar la forma en que `skills` descubre o entrega los cuerpos.

## Decisions

**`skill` y `hook` van en `permissions`, no en `skills`/`hooks`.** El catálogo de
acciones es el vocabulario común del portero. `skills` y `hooks` ya dicen cómo se
comportan sus acciones; lo que falta es que `permissions` las reconozca como
acciones de primera clase. Sin esa entrada, una regla que nombre `skill` o `hook`
queda fuera de la lista normativa.

**El recurso de `skill` es el identificador y el de `hook` es el evento.** Es la
misma decisión que ya toman `skills` y `hooks`. Ponerlo también en `permissions`
evita que el catálogo describa la acción sin decir sobre qué se aplica.

**Los permisos de agente se declaran en `agents` y se combinan en `permissions`.**
`agents` define la forma del dato; `permissions` define el orden de aplicación.
Separar las dos cosas mantiene cada capacidad con una responsabilidad clara y evita
duplicar el merge.

**Una regla de permiso inválida falla el arranque.** Es el mismo criterio que ya
usan las herramientas y los modelos: una política mal formada no se adivina. El
mensaje nombra la definición y la posición de la regla, igual que el resto de las
definiciones inválidas.

**El panel va en `interface`, no en `skills`.** `skills` descubre, anuncia y
entrega; `interface` muestra. El panel es una vista del catálogo, no una regla de
descubrimiento. Se especifican cuatro escenarios: abrir el panel, proyecto sin
skills, skills omitidas y panel que no inicia un turno.

**No se endurecen las acciones desconocidas en este change.** `permissions` no
tiene hoy un requisito sobre acciones inválidas. Agregarlo acá obligaría a cambiar
el código y a decidir qué pasa con configuraciones existentes. Se deja como deuda
explícita para un change posterior.

## Risks / Trade-offs

- [El spec puede volver a quedar atrás del código] → Los escenarios nuevos se
  derivarán a tests en el change de implementación; este change no los agrega.
- [El panel `/skills` podría considerarse una capacidad de `skills`] → Se ubica en
  `interface` porque describe lo que ve la persona; `skills` sigue siendo el
  descubrimiento y la entrega.
- [Una acción desconocida sigue cayendo en `read`] → Se documenta como fuera de
  alcance; no se oculta la deuda.

## Migration Plan

No hay migración. Los specs cambian, el comportamiento no. Para volver atrás
alcanza con descartar el change.
