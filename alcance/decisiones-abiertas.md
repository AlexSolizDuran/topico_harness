# Decisiones abiertas

Lo que falta decidir. Ninguna bloquea la construcción, pero la primera cambia
comportamiento y conviene resolverla antes de escribir código.

Se actualiza a medida que se advance. Cuando una decisión se tome, se mueve al
OpenSpec y sale de acá.

## Resueltas

### Superficie: terminal (TUI)

**Decidido 2026-10-13.** Un solo proceso, sin red, sin auth.

Descartado: desktop (Electron, Tauri) por bundle, firma y updates.
Descartado: web, por auth del daemon, `Origin` obligatorio y una capa de red
que multiplica el debugging.

Ver [README.md](README.md) para la comparación.

### Lenguaje y UI: TypeScript + Ink 7

**Decidido 2026-10-13.** Node 24.18.0, ESM, TypeScript strict, Ink 7 +
React 19.

Descartado: OpenTUI, que es mejor renderer para streaming de agentes pero pide
Node 26.4+ con `--experimental-ffi` o Bun 1.3+, está en 0.x con releases
semanales, y su binding de React no tiene CI de Node (el de Solid sí; la TUI de
OpenCode corre sobre Solid).

Descartado: Textual (Python), porque rompe el stack TS ya conocido y ata el
núcleo a un rewrite si algún día hay UI web.

### Plataformas de la v1: Linux y macOS

**Decidido 2026-10-13.** Windows fuera de alcance.

Requiere tres ramas que la v1 no prueba: TTY real (Node en Windows a veces no
da TTY y Ink degrada), shell alternativa (no hay `bash`), y normalización de
rutas (`\` vs `/`).

Es más barato decir "no soportado" que mantener tres ramas sin probar.

### Loop de tools: usar el del AI SDK

**Decidido 2026-10-13.** AI SDK v7 trae `ToolLoopAgent`, que es el
agente→tool→agente como tipo propio.

Pendiente de confirmar en la práctica cuánto control falta. Si resulta que no
alcanza, la alternativa es `streamText` con `isStepCount` y el loop propio.

### Modelos externos

**Decidido 2026-10-13.** El provider va detrás de una interfaz propia. El SDK
vive solo en `provider/`.

Agregar un provider después no toca el loop. El coste es una interfaz más que
mantener.

## Abiertas

### 1. ¿Cuál es el provider de la v1?

**Impacto:** el adapter inicial. La interfaz no cambia.

| Opción | A favor | En contra |
|---|---|---|
| Solo Anthropic | El tool calling más confiable | Un solo punto de falla |
| Solo OpenAI | Idem | Idem |
| Ambos | Agnóstico de verdad | Más trabajo de tests desde el día 1 |

**Recomendación:** uno solo en la v1. La interfaz agnóstica se escribe igual;
el segundo adapter se agrega después en un change chico.

### 2. ¿El harness solo edita, o también ejecuta?

**Impacto:** si `bash` corre cualquier cosa, el gate de aprobación del Nivel 4
pasa de "nice" a "necesario desde el día uno".

| Opción | Consecuencia |
|---|---|
| Solo lectura y edición | v1 más chica, Nivel 4 postergable |
| También ejecuta, sin gate | Riesgo alto |
| También ejecuta, con gate | El gate entra en la v1 |

**Recomendación:** la v1 incluye `bash`, pero **con lista negra de comandos
peligrosos** como mínimo. Es media hora de trabajo y evita el peor escenario
(`rm -rf`).

### 3. ¿Cómo se persisten las sesiones?

**Impacto:** el Nivel 4. Si no hay persistencia, cerrar pierde todo.

| Formato | A favor | En contra |
|---|---|---|
| JSONL en `.harness/` | Append-only, recuperable | Hay que reconstruir en memoria |
| JSON completo | Simple | Un corte de escritura pierde todo |
| SQLite | Consultable, transaccional | Un día de setup |

**Recomendación:** JSONL. Append-only significa que un corte a mitad de turno
pierde ese turno, no la sesión.

Nota: si la v1 no incluye Nivel 4, esta decisión también se posterga.

### 4. ¿Los subagentes heredan el contexto del padre?

**Impacto:** el tamaño del prompt del subagente.

| Opción | A favor | En contra |
|---|---|---|
| Contexto vacío | Barato, no carga historia | Pierde el objetivo |
| Solo el objetivo y el cwd | Contexto chico y útil | Hay que pasarle el objetivo |
| Historial completo | No pierde nada | Cuesta 50.000 tokens |

**Recomendación:** contexto vacío + el objetivo explícito en el prompt. Es lo que
hace el Nivel 3 y por lo que el padre no se infla.

### 5. ¿El harness escribe en el repo donde trabaja?

**Impacto:** dónde viven `AGENTS.md` y la memoria del Nivel 8.

| Opción | A favor | En contra |
|---|---|---|
| Sí, en el proyecto | Contexto correcto por repo | Modifica el repo del usuario |
| No, todo en `~/` | No toca el repo | Pierde el contexto del proyecto |

**Recomendación:** sí, en el proyecto. Es lo que ya hacés con `finanzas/mvp`:
el `AGENTS.md` vive en el repo. Y `.gitignore` lo maneja si no querés versionarlo.

### 6. ¿Cuándo es "mucho" contexto?

**Impacto:** el presupuesto del Nivel 2.

| Opción | A favor | En contra |
|---|---|---|
| Contador exacto del provider | Preciso | Depende del provider |
| Estimación `length/4` | Cero dependencias | +-25%, hay que cortar antes |
| Tokenizer local | Preciso y offline | Una dependencia más |

**Recomendación:** el contador del provider cuando exista (ya viene en cada
respuesta, gratis), con `length/4` como fallback y margen conservador.

### 7. ¿El modelo propone y el humano ejecuta, o al revés?

**Impacto:** la UI del Nivel 4. Es una decisión de confianza, no técnica.

| Opción | A favor | En contra |
|---|---|---|
| El agente hace todo | Rápido | Sorprende |
| Propone diffs, humano aplica | Control total | Fricción en cada paso |
| Mixto por tipo de tool | Equilibrio | Más lógica |

**Recomendación:** mixto por efecto. Lecturas sin gate, escrituras con gate,
`bash` con lista negra. Es el patrón que usa OpenCode.

## Cómo se resuelven

Las que cambian comportamiento se resuelven **antes** de escribir el change
correspondiente. Las demás, cuando se lleguen.

Ninguna de las siete bloquea la escritura del OpenSpec: se puede documentar el
alcance y dejar las decisiones marcadas en los requisitos donde importen.