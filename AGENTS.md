# AGENTS.md

Instrucciones para cualquier agente o harness que trabaje en este repositorio.
Esta documentación es autocontenida: no hace falta leer ningún chat previo.

## Qué es esto

Un harness de coding agent: el programa que le da a un LLM las capacidades que
el modelo no tiene. Lee archivos, ejecuta herramientas, gestiona el contexto y se
cancela a mitad de tarea.

**El modelo es el motor. El harness es el chasis.**

La implementación está completa: los 25 changes de `openspec/changes/archive/` están
implementados y `src/` y `tests/` ya existen. `npm run check` pasa con 406
tests. La prueba de punta a punta contra OpenRouter también pasó, en modo plano y
con herramientas reales.

## Estado del OpenSpec

| | |
|---|---|
| Capacidades | 9 |
| Requisitos | 113 |
| Escenarios | 356 |
| Implementación | 25 changes, `npm run check` en verde (406 tests) |
| Validado | contra las reglas del schema `spec-driven` |

| Capacidad | Requisitos | Escenarios | Qué cubre |
|---|---|---|---|
| `core` | 12 | 41 | el bucle: iteración, historial atómico, despacho, validación, errores como texto, límite de pasos, cancelación, espera de aprobación, tandas paralelas, detección de bucles |
| `provider` | 7 | 24 | la frontera con el modelo: interfaz agnóstica, traducción de eventos, reintentos, credencial, conteo de tokens, cambio de modelo entre turnos |
| `tools` | 21 | 79 | lectura, escritura, edición, búsqueda, ejecución `shell` por catálogo con aprobación obligatoria de lo riesgoso, redirecciones, archivos sensibles, delegación `task`, esquemas, acción/recurso de permiso, metadato de paralelo, truncado, rutas |
| `context` | 10 | 28 | presupuesto, conteo, recorte, compactación, validación entre pasos, presupuesto independiente por subagente y las tres reglas que no se rompen |
| `interface` | 22 | 67 | streaming, herramientas y tandas visibles, delegación diferenciada, aprobaciones interactivas, cambio de agente (`Tab` y `/agente`), input, cancelación, degradación sin terminal, indicador de tareas en background, ramas (`/rama`) y búsqueda (`/sesiones buscar`) |
| `sesiones` | 11 | 24 | guardado incremental por turno, reanudación con historial y configuración, listado, credencial redactada, compactación como reemplazo, límite por proyecto, ramas desde un turno anterior y búsqueda por texto |
| `agents` | 6 | 20 | perfiles declarativos de agente (`build`, `plan`, `explore`), modos (`primario`, `subagente`, `ambos`), filtrado estricto de herramientas, modelo propio y defaults |
| `subagents` | 15 | 37 | delegación con contexto aislado, profundidad máxima 1, intersección de solo lectura, cancelación unidireccional, presupuesto/pasos/modelo propios y tareas en background con continuación del turno |
| `permissions` | 9 | 36 | reglas ordenadas (`permitir`, `consultar`, `denegar`), aprobación obligatoria que ninguna regla salta, política base para `.env`, merge global + agente, aprobaciones (`una_vez`, `siempre`, `denegar`) y degradación sin TTY |

`openspec/specs/<capacidad>/spec.md` es la fuente de verdad. La estructura de cada
spec es fija: `## Purpose`, luego `## Requirements`, y dentro `### Requirement:`
con el texto normativo (SHALL / SHALL NOT) y sus `#### Scenario:` en formato
`- **WHEN**` / `- **THEN**`.

**Los specs son neutrales de stack a propósito.** No mencionan lenguajes,
frameworks ni nombres de archivo, para sobrevivir a un cambio de stack sin
reescrituras. El stack vive únicamente en `openspec/config.yaml`.

## Configuración del CLI

El paquete se llama **`@fission-ai/openspec`**. No es `openspec`: ese nombre
pertenece a un paquete ajeno sin binario.

```bash
npm install -g @fission-ai/openspec@latest
openspec init --tools opencode
```

`init` refresca un `openspec/` existente sin tocar los specs, y no sobrescribe el
campo `context` de un proyecto ya configurado.

**Después de `init`, reinicia opencode.** La configuración se carga al arrancar y
no se recarga en caliente. Aparecen `.opencode/commands/opsx-*.md` y
`.opencode/skills/openspec-*/SKILL.md`.

### Forma de los comandos en opencode

El id de la herramienta es `opencode` y escribe `opsx-<id>.md`, así que los
comandos usan **guion**, no dos puntos:

| | |
|---|---|
| opencode (este repo) | `/opsx-propose` `/opsx-apply` `/opsx-archive` |
| Claude Code, Gemini | `/opsx:propose` `/opsx:apply` |

Confundir esto es el error más fácil de cometer.

El CLI corre en la terminal (`openspec validate`, `list`, `show`, `new change`);
los `/opsx-*` corren en el chat. El CLI es el que instala los comandos.

## Cómo se ejecuta el trabajo

`openspec/specs/` es el diseño **objetivo ya acordado**: describe cómo se
comportará el sistema, no cómo se comporta hoy. Como ya está completo, cada change
**implementa** contra esos requisitos en vez de re-derivarlos.

Ciclo por change:

```bash
openspec new change 020-provider
```
```
/opsx-propose 020-provider   # redacta proposal + design + tasks
# revisión
/opsx-apply                  # implementa desde tasks.md
/opspec-archive              # lo mueve a changes/archive/
```

Cada change lleva `skip_specs: true` en su `.openspec.yaml`: no introduce
comportamiento nuevo, solo materializa lo ya especificado. Sin ese marcador,
`openspec validate` rechaza un change con cero deltas.

```yaml
schema: spec-driven
skip_specs: true
```

`openspec new change <id>` crea el directorio pero puede no escribir ese archivo:
créalo a mano antes de `/opsx-apply`.

Al proponer, lee primero la capacidad con `openspec show <capacidad> --type spec`
y cita sus requisitos por nombre.

## Orden de implementación

| # | change | capacidad | req | esfuerzo |
|---|---|---|---|---|
| 1 | `020-provider` | provider | 6 | ½ día |
| 2 | `010-nucleo` | core | 9 | ~3 días |
| 3 | `030-tools` | tools | 11 | ~2 días |
| 4 | `040-interface` | interface | 7 | ~2 días |
| 5 | `050-context` | context | 9 | ~2 días |

**`020-provider` va primero aunque el número sea 020.** Parece contraintuitivo: el
Nivel 0 (una llamada, media tarde) se hace *dentro* del change de `provider`, y
después `010-nucleo` usa esa interfaz. Si `provider` no existe primero, `nucleo`
no tiene contra qué probarse.

El prefijo numérico ordena el `openspec list`.

## Las dos reglas más importantes

### 1. El núcleo no importa nada de la interfaz

`src/core/` no importa desde `src/interface/`, nunca. Eso hace **reversible** la
decisión terminal↔web sin reescribir el loop, y es lo que permite testear el núcleo
sin UI: es un bucle async que entra con un prompt y sale con eventos.

Se verifica con un test que falla si `core/` importa desde `interface/`. Ese test
llega con `010-core`, porque necesita que la carpeta exista.

### 2. Un error nunca se tira: vuelve al modelo como texto

```ts
try {
  return await ejecutar(tool, args)
} catch (e) {
  return `ERROR: ${e.message}\nLa operación no se completó.`
}
```

Si se tira la excepción, el proceso muere a mitad de tarea. Si vuelve como texto,
el modelo lo lee **se corrige solo** y sigue. Es la diferencia entre un harness
que se frena y uno que termina.

El mensaje de error no debe filtrar la credencial ni rutas sensibles. Truncalo a
un largo razonable.

## Arquitectura

Las carpetas de `src/` se llaman igual que las capacidades de `openspec/specs/`.
Leés `openspec/specs/core/spec.md` y abrís `src/core/`. Sin tabla de traducción.

```
      interface/       Ink. Solo dibuja lo que recibe.
          │
          ▼
       core/           el bucle. No sabe qué hay abajo.
          │
   ┌──────┼──────┐
   ▼      ▼      ▼
provider/ tools/ context/

Flechas hacia abajo. Nunca hacia arriba.
core/ NO importa interface/.
```

| Carpeta | Qué vive ahí | Spec |
|---|---|---|
| `src/types.ts` | `Mensaje`, `Evento`, `EstadoTurno`, `PorteroPermisos` | cruza varias capacidades |
| `src/core/` | el bucle, el historial, el despacho, las tandas, los loops, la cancelación | `core` |
| `src/provider/` | la interfaz del provider y su adaptador | `provider` |
| `src/tools/` | las herramientas, el catálogo y la lista negra como etiquetas de riesgo | `tools` |
| `src/context/` | presupuesto, recorte y compactación | `context` |
| `src/interface/` | la interfaz de terminal | `interface` |
| `src/agents/` | perfiles declarativos de agente, carga y defaults | `agents` |
| `src/subagents/` | ejecutor aislado, herramientas `task`/`task_status`/`task_cancel` y gestor en background | `subagents` |
| `src/sesiones/` | formato, almacén, reproducción, poda, ramas y búsqueda de sesiones | `sesiones` |
| `src/permissions/` | motor de reglas, portero y persistencia de aprobaciones | `permissions` |

**`src/types.ts` contiene solo lo que cruza dos o más módulos.** Si un tipo lo
usa un solo módulo, vive en ese módulo. Sin esa regla, `types.ts` se convierte en
el cajón donde cae todo lo que no tiene otro lugar.

`core/` recibe sus dependencias por parámetro y devuelve un flujo de eventos. No
importa `provider/` ni `tools/` como valores: los recibe. Por eso el núcleo se
puede testear sin interfaz y sin provider real.

## Convenciones de código

**Rutas en inglés, identificadores en español.** Es el mismo reparto que usan los
specs: carpeta `core/`, requisitos en español.

```ts
// src/core/turn.ts
export const MAXIMO_PASOS = 25
export async function* ejecutarTurno(): AsyncGenerator<Evento, EstadoTurno> {}
```

| Qué | Cómo | Ejemplo |
|---|---|---|
| Carpetas y archivos | inglés, minúsculas | `src/tools/read.ts` |
| Funciones y variables | camelCase español | `ejecutarTurno()` |
| Tipos e interfaces | PascalCase español | `EstadoTurno` |
| Constantes | `SCREAMING_SNAKE` | `MAXIMO_PASOS` |
| Nombres de herramienta | inglés | `read`, `write`, `edit`, `shell` |

Los nombres de herramienta van en inglés **porque son los que ve el modelo**. No
es una excepción de estilo: es que el modelo los llama así.

Además:

- Imports relativos con extensión `.js` aunque el archivo sea `.ts` (`nodenext`)
- `node:fs`, nunca `fs` (lo exige `biome.json`)
- Comentarios que explican **por qué**, nunca qué hace el código
- Un archivo, una responsabilidad. Si un archivo pasa las 200 líneas, probablemente
  son dos

## Reglas de calidad

**1. Un test por escenario.** `openspec/specs/core/spec.md` tiene 41 escenarios y
`tests/core/` los cubre todos. El nombre del test es el nombre del escenario,
literal. Cuando agregás un requisito, agregás su escenario y su test.

Es la única regla que ata código a spec. Con 113 requisitos y 356 escenarios, es la
que justifica el resto.

**2. La dirección de dependencia se verifica con un test, no con una promesa.** Un
test lee los archivos de `src/core/` y falla si encuentra un import de
`interface`, `agents`, `subagents` o `permissions`. Vive en `tests/core/`.

**3. `any` explícito es error.** `biome.json` lo marca. La razón: los datos vienen
de un modelo, y un `any` ahí esconde exactamente los bugs que más duelan.

**4. `npm run check` antes de dar por terminado un bloque.** Encadena lint,
typecheck y tests. Hoy pasa con 406 tests.

## Stack

Vive en `openspec/config.yaml`. Resumen:

- **Node 24**, ESM (`"type": "module"`), TypeScript 7.0.2
- **Ink 7.1.1** + React 19.3.0 para la interfaz de terminal
- **zod 4.6.7** para los esquemas de las herramientas
- **Biome 2.5.15** para lint y formato
- **Vitest 5.0.4** para pruebas
- **Linux, macOS y Windows**

Módulos con `nodenext`: los imports relativos llevan extensión `.js` aunque el
archivo sea `.ts`. Es lo que Node verá después de compilar.

## Configuración, modelos y arranque

`npm run dev` ejecuta `src/main.ts` con `tsx`; `npm run build` compila a `dist/` y
`npm start` ejecuta lo compilado. `npm run link` construye y enlaza el binario
`harness` de forma global.

La configuración vive en `.harness/config.json`. Ese archivo está ignorado por
git, igual que `.env`; el ejemplo versionado es `.harness/config.example.json`.
La credencial se toma de `variableApiKey` (el nombre de una variable de entorno,
preferido) o de `apiKey` literal. `apiKey` solo se acepta en el archivo local
ignorado; nunca en el ejemplo ni en un archivo versionado. La credencial se pasa a
`credencialesSanitizar` para redactarla de errores y resultados.

Cada modelo declara:

- `id`: el identificador que espera el provider, por ejemplo
  `openai/gpt-4o` en OpenRouter.
- `soportaHerramientas`: si es `false`, el adaptador no envía `tools`.
- `ventanaContexto`: base para el presupuesto (80% por defecto).
- `maxTokensSalida`: tope de `max_tokens` de la respuesta. Sin este valor,
  OpenRouter puede reservar su máximo y rechazar la petición por crédito.

Para agregar un modelo alcanza con sumar una entrada a
`proveedores.<id>.modelos` y elegirlo con `--modelo proveedor/modelo` al arrancar
o con `/modelo` dentro de la TUI. `/modelo` sin argumentos lista los disponibles;
el cambio es atómico y conserva el historial.

Para agregar un provider nuevo: implementar `Proveedor` en
`src/provider/adapters/`, registrarlo por `tipo` en
`src/provider/factory.ts` y declarar ese `tipo` en la configuración. El núcleo no
importa el adaptador: lo recibe por parámetro.

Sin pedido inicial y con `stdin`/`stdout` de terminal se abre la TUI de Ink. Con
un pedido por argumentos, o sin terminal interactiva, se usa el renderizador de
línea a línea y el proceso termina solo. `--dir` elige el proyecto; si no existe,
sale con código `1`.

## Decisiones cerradas

No contradigas los specs. En resumen:

1. **Superficie: terminal.** Un solo proceso, sin red, sin auth. Descartado desktop
   por bundle, firma y updates. Descartado web por auth del daemon y una capa de
   red que multiplica el debugging.
2. **TypeScript + Ink 7.** Node 24, ESM, strict.
3. **Plataformas: las tres.** Linux, macOS y Windows. La ejecución de comandos
   usa un catálogo por plataforma: Unix con `exec`; Windows con PowerShell. El
   catálogo y la lista negra son etiquetas de riesgo, no un muro: un comando fuera
   del catálogo, de la lista negra o una línea compuesta en Windows pide aprobación
   obligatoria. Falta verificar el camino de Windows en CI: el desarrollo y la
   prueba real fueron en Linux.
4. **El provider va detrás de una interfaz propia.** El SDK vive solo en el
   adaptador. Agregar un provider después no toca el loop.
5. **Nada se rechaza: lo riesgoso pide aprobación obligatoria.** La lista negra se
   evalúa por nombre completo, nunca por combinación de flags: `rm -rf` es evadible
   con `rm -fr`, `rm -r -f`, `rm -f -r` o `rm --recursive --force`. Verificado en
   GNU coreutils 9.7. Una regla `denegar` configurada sigue siendo la última
   palabra; ninguna regla `permitir` ni aprobación guardada salta la aprobación
   obligatoria.
6. **Sin base de datos en ningún nivel.** El estado vive en memoria durante el
   turno y la persistencia de sesiones es JSONL en `.harness/sesiones/`. Nada de
   SQLite.

Fuera de alcance de la v1: hooks, sandbox, LSP, MCP y memoria.

## Reglas de trabajo

Se cargan en toda sesión. Si una contradice a un spec, el spec manda.

1. **El spec manda sobre el código.** Si divergen, se edita `openspec/specs/` y se
   vuelve a validar, nunca el código.
2. **Nada de commits ni push sin pedido explícito.** Un agente no commitea por
   iniciativa propia.
3. **Cero secretos en el repo.** La credencial se lee del entorno (`.env`) o de
   `.harness/config.json`, que está ignorado. El ejemplo versionado no lleva
   secretos. La credencial se redacta de los errores y nunca aparece en un evento
   ni en un log.
4. **Verificar antes de decir que está.** No reportes algo como funcionando sin
   haber corrido el comando.
5. **Los errores vuelven al modelo, no se tiran.** Ver la regla 2 de arriba.
6. **`npm run check` antes de dar por terminado un bloque.** Encadena lint,
   typecheck y tests.

## Otros documentos

| Archivo | Contenido |
|---|---|
| `alcance/` | Por qué el harness se construye por niveles. 12 documentos de referencia. El razonamiento, no el contrato |
| `openspec/config.yaml` | Contexto que OpenSpec inyecta: stack, reglas, flujo, estado |
| `openspec/specs/` | El contrato: 9 capacidades, 113 requisitos, 356 escenarios |
| `PREGUNTAS.md` | Las decisiones ya resueltas y las que se postergaron |
| `src/` | La implementación, una carpeta por capacidad. La arquitectura está en la sección de arriba |
| `tests/` | Un test por escenario, agrupado por capacidad |

## Cuando el spec y el alcance se contradigan

`alcance/` explica el porqué de cada decisión y puede quedar viejo.
`openspec/specs/` es el contrato y manda. Si un cambio de comportamiento se
decide, primero se actualiza el spec, después se actualiza `alcance/`.

## Skills del proyecto

En `.opencode/skills/`. Se cargan **solo cuando su descripción dispara**, a
diferencia de este archivo que se carga siempre.

Conviven con las 6 skills `openspec-*` que instala el CLI. No reescribas ni
dupliques esas.

| Skill | Cuándo |
|---|---|
| `agregar-tool` | Escribís o modificás una herramienta |
| `errores-como-texto` | Escribís código que puede fallar |
| `escenarios-a-tests` | Escribís o modificás tests, o agregás un requisito |