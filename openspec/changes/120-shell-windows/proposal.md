# Proposal

## Why

En Windows la herramienta de ejecución no existe: el spec actual la prohíbe
porque una lista negra por nombre no aguanta los nueve alias de borrado de
PowerShell. Eso deja al agente sin poder correr tests ni comandos en la mitad de
las plataformas objetivo. Con una allowlist por comando y una regla de invocación
simple, la garantía que el mecanismo puede sostener cambia de forma y Windows
puede entrar.

## What Changes

- Exponer la herramienta de ejecución en Windows, usando PowerShell.
- Catálogo propio de Windows con cmdlets y ejecutables; sin `rm`, `del`, `erase`,
  `rd` ni `Remove-Item`.
- Rechazar líneas que compongan varios comandos (`;`, `&&`, `||`, `|`, `` ` ``,
  `$()`, saltos de línea) en todas las plataformas.
- Nombre de herramienta por plataforma: `bash` en Unix, `powershell` en Windows.
- **BREAKING**: un comando compuesto que antes se ejecutaba en Linux ahora se
  rechaza. El agente puede hacer dos llamadas o usar un script de npm.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `tools`: se reemplaza el requisito «La herramienta de ejecución se resuelve
  contra el catálogo de la plataforma» por «La herramienta de ejecución se
  resuelve contra el catálogo de cada plataforma», que incluye Windows,
  PowerShell y la regla de invocación simple. El escenario «La herramienta no
  está disponible en Windows» desaparece con el requisito anterior.

## Impact

- `src/tools/shell.ts`: catálogo de Windows, intérprete, extracción del binario y
  validación de invocación simple.
- `tests/tools/`: se reemplaza el test de «no disponible en Windows» por dos
  nuevos.
- `AGENTS.md` (decisión 3) y `openspec/config.yaml` (bloque de Windows).
- `openspec/specs/tools/spec.md` se actualiza al archivar el change.
- `openspec/config.yaml`: 44 requisitos y 123 escenarios.
