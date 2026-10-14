# Preguntas pendientes

Lo que falta decidir. Ninguna bloquea la construcción: las 5 capacidades están
escritas en `openspec/specs/` y se pueden implementar tal cual están.

## Abiertas

### ¿Cuál es el provider de la v1?

**Impacto:** el adaptador inicial de `020-provider`. La interfaz no cambia, solo lo
que se implementa detrás.

| Opción | A favor | En contra |
|---|---|---|
| Solo Anthropic | El tool calling más confiable | Un solo punto de falla |
| Solo OpenAI | Ídem | Ídem |
| Ambos | Agnóstico de verdad | Más trabajo de tests desde el día 1 |

**Recomendación:** uno solo en la v1. La interfaz agnóstica se escribe igual; el
segundo adaptador se agrega después en un change chico.

**Dónde se decide:** en el `design.md` de `020-provider`, no en el spec. El spec
de `provider` es agnóstico a propósito y ninguno de sus 6 requisitos nombra un
proveedor.

## Postergadas

Se resuelven cuando se llegue al nivel correspondiente. Ninguna bloquea.

### ¿Cómo se persisten las sesiones?

**Nivel 4.** Si no hay persistencia, cerrar el harness pierde la conversación
entera. Hoy eso es aceptable: el requisito `core` de cancelación deja el estado
consistente, no durable.

| Formato | A favor | En contra |
|---|---|---|
| JSONL en `.harness/` | Append-only, recuperable | Hay que reconstruir en memoria |
| JSON completo | Simple | Un corte de escritura pierde todo |
| SQLite | Consultable, transaccional | Un día de setup |

**Recomendación:** JSONL. Append-only significa que un corte a mitad de turno
pierde ese turno, no la sesión.

### ¿Los subagentes heredan el contexto del padre?

**Nivel 3.** Contexto vacío + el objetivo explícito en el prompt. Es lo que hace
que el padre no se infla.

### ¿El harness solo edita, o también ejecuta?

**Resuelto para la v1, la pregunta más grande vuelve en el Nivel 4.** Hoy la
respuesta es: lee, busca, escribe y edita, y ejecuta comandos de un catálogo con
lista negra **en Linux y macOS solamente**. En el Nivel 4 la pregunta real es si
`write` —que puede sobrescribir cualquier archivo del proyecto— pasa por el mismo
gate que la ejecución.

### ¿Cuántos reintentos antes de rendirse?

`provider` acota el número de reintentos pero no fija la cifra. Es el único
parámetro de los cuatro sin valor por defecto. Los otros tres están en
`openspec/config.yaml`: 25 pasos, 80% de la ventana, 30.000 caracteres.

**Propuesta:** 3 intentos. Se define en el `design.md` de `020-provider`.

## Resueltas

Se documentan acá porque `alcance/decisiones-abiertas.md` es el registro original
y estas decisiones ya se escribieron en los specs.

### Plataformas: Linux, macOS y Windows

**Decidido.** Invertido lo que decía `alcance/`, que las excluía. Motivos que ya no
aplican: la CI en los tres sistemas se monta con un archivo de 25 líneas, y la
ejecución de comandos en Windows se resolvió *deshabilitándola* en la v1 en vez de
prometer una garantía que el mecanismo no sostiene.

### Catálogo de comandos y lista negra

**Decidido.** Un catálogo por plataforma, y encima una lista negra por nombre
completo. Se descartó la clasificación por categoría de efecto: con la ejecución
deshabilitada en Windows, no hace falta.

La lista negra bloquea **nombres**, nunca cadenas. `rm -rf` es evadible con
`rm -fr`, `rm -r -f`, `rm -f -r` o `rm --recursive --force`.

### La interfaz sí es una capacidad

**Decidido.** `interface` es uno de los 5 specs, con 7 requisitos. El que la hace
viable es *"sin terminal interactiva, degrada a salida línea a línea"*.

### Nombres de las capacidades en inglés

**Decidido.** `core`, `provider`, `tools`, `context`, `interface`. Los requisitos
van escritos en español con los marcadores estructurales en inglés, porque el CLI
los parsea.
