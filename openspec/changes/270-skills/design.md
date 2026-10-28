# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `construirHarness` (`src/app.ts`) arma la sesión y ya compone el prompt de
  sistema con las instrucciones del proyecto. Es el punto natural para descubrir
  skills y armar el anuncio.
- `RegistroHerramientas` es un registro por datos: nombre, esquema, acción de
  permiso, recurso y ejecutor. Una herramienta nueva es una entrada más.
- `recortarSalidasHerramientasViejas` reemplaza **todo** resultado de herramienta
  antiguo por un marcador, salvo el más reciente. El cuerpo de una skill es un
  resultado de herramienta: sin excepción, se borra sola.
- `AccionPermisoCanon` es un conjunto cerrado; sumar `skill` obliga a tocar el
  validador de reglas y el filtrado de anuncio.
- La TUI resuelve los comandos en `app-interactiva.tsx` por identificador; el
  renderizador de línea a línea no tiene comandos.

## Goals / Non-Goals

**Goals:**

- Que el catálogo cueste decenas de tokens y el cuerpo se pague solo al usarse.
- Que una skill malformada degrade a "no disponible con aviso", nunca a sesión
  rota.
- Que el cuerpo cargado sobreviva al recorte de contexto.

**Non-Goals:**

- Recarga en caliente: editar un `SKILL.md` con la sesión abierta se ve en la
  próxima.
- Ejecutar scripts de apoyo: solo se listan rutas; el agente las lee con `read`.
- Skills globales o por agente.

## Decisions

**Frontmatter parseado a mano, sin dependencia de YAML.** Solo se leen `name` y
`description` de un bloque entre `---`. Agregar `yaml` por veinte líneas de código
no se justifica. Alternativa descartada: frontmatter JSON, más incómodo de escribir
a mano.

**Solo `.opencode/skills` del proyecto.** Mismo criterio que `instructions`: el
ámbito es el proyecto. Alternativa descartada: sumar `~/.config/opencode/skills`,
que mezcla configuración personal con contrato del repo.

**Skill malformada: se omite con aviso. Skill gigante: falla el arranque.** Son
dos fallas distintas. Una skill sin descripción está incompleta y el agente no
puede decidir cuándo usarla; omitirla no rompe nada. Un `SKILL.md` de 200 KiB es
una decisión de tamaño que hay que corregir: truncarlo sería mentirle al agente
sobre lo que leyó.

**El anuncio va después de las instrucciones y antes del prompt del agente.** El
orden queda `base → AGENTS.md → catálogo → agente`. El catálogo es información, no
norma; el agente sigue especializando al final.

**El cuerpo vuelve como resultado de herramienta, no como mensaje de sistema.** Así
entra al historial, se puede compactar y el modelo lo ve donde corresponde.
Alternativa descartada: inyectarlo como `system`, que lo haría permanente y caro.

**El cuerpo se marca como no recortable.** El marcador de recorte existe para
liberar salidas de herramientas que el modelo ya procesó. Un cuerpo de skill no es
una salida: es una instrucción vigente. Se resuelve con una marca en el mensaje de
resultado y una excepción en el recorte.

**El catálogo se arma al construir la sesión.** Sin recarga. Es el mismo criterio
que las instrucciones del proyecto.

**El panel `/skills` muestra también las omitidas.** Es la contraparte visible de
la decisión de saltear: sin eso, una skill que no aparece es indistinguible de una
skill que no existe.

## Risks / Trade-offs

- [Un catálogo grande infla el prompt] → El costo es proporcional al número de
  skills; el panel `/contexto` muestra los tokens del anuncio para que se vea.
- [El cuerpo de la skill puede instruir cualquier cosa] → Es contenido del propio
  repo, con la misma confianza que `AGENTS.md`; el permiso `skill` permite
  denegarla por identificador.
- [Marcar mensajes como no recortables reduce el espacio recuperable] → Solo aplica a cuerpos de skill efectivamente cargados, que son pocos y acotados por el tope.
- [El parseo manual de frontmatter es frágil] → Se aceptan solo dos claves y una
  forma simple; cualquier otra cosa omite la skill con aviso en vez de adivinar.

## Migration Plan

No hay migración: es una capacidad nueva y opt-in por presencia de
`.opencode/skills`. Para volver atrás alcanza con no tener la carpeta.
