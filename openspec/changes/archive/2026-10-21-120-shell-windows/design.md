# Design

## Context

Ver `proposal.md` — Why. `crearHerramientaShell` devuelve `undefined` en `win32`.
El catálogo Unix y la lista negra ya existen. `exec` usa `/bin/sh` en Unix y
`cmd.exe` en Windows; para PowerShell hay que elegir el intérprete explícito.

## Goals / Non-Goals

**Goals:**

- Windows con ejecución acotada por allowlist.
- Rechazo de comandos compuestos en todas las plataformas.
- Tests de la lógica sin necesitar Windows.

**Non-Goals:**

- Sandbox real. La allowlist no impide que un binario permitido haga daño.
- Lista negra de flags (`git clean -fdx`, `npm publish`).
- PowerShell 7 (`pwsh`); se usa el que viene con Windows.
- Shell interactivo persistente.

## Decisions

### Intérprete

`powershell.exe -NoProfile -NonInteractive -Command <comando>` con `spawn`. No se
usa `exec` porque su shell por defecto en Windows es `cmd.exe`, y cambiar el
comportamiento con `shell:` complica el escapado. Alternativa descartada: `cmd.exe`,
con menos cmdlets útiles y alias de borrado igual de problemáticos.

### Catálogo de Windows

Cmdlets y ejecutables, en minúsculas para comparar:

`git`, `npm`, `node`, `npx`, `vitest`, `cargo`, `python`, `py`, `go`,
`get-childitem`, `get-content`, `select-string`, `get-location`, `new-item`,
`copy-item`, `move-item`, `test-path`, `resolve-path`, `get-command`,
`write-output`, `measure-object`, `compare-object`.

No se incluyen `rm`, `del`, `erase`, `rd`, `ri`, `rmdir`, `remove-item`,
`clear-content` ni ningún alias que borre.

### Invocación simple

Antes de resolver el nombre se valida la línea completa:

- rechazar `;`, `&&`, `||`, `|`, `&`, `` ` ``, `$(`, saltos de línea,
- ignorar esos caracteres dentro de comillas simples o dobles,
- rechazar una línea vacía.

El chequeo se hace sobre la línea original, no sobre tokens, para no depender del
intérprete. Aplica en Linux y macOS también. Alternativa descartada: permitir
`;` y confiar en la allowlist, que deja `Get-ChildItem; Remove-Item` a un paso.

### Nombre de la herramienta

`bash` en Unix y `powershell` en Windows. El modelo necesita saber el dialecto:
si ve `bash` en Windows va a escribir `&&`, que PowerShell 5.1 no entiende. El
nombre es lo que el modelo lee, no una preferencia estética.

### Extracción del nombre

Se toma el primer token, se separa por `/` y `\`, se quita el sufijo `.exe` y se
compara en minúsculas. Un `C:\Program Files\Git\bin\git.exe` resuelve a `git`.

### Lista negra en Windows

Queda vacía. La defensa es la allowlist. El requisito «Un comando de la lista
negra no se ejecuta» sigue vigente: en Windows no hay comandos en esa lista, así
que se cumple de forma vacía. No se inventan alias de borrado para bloquear algo
que ya no está permitido.

## Risks / Trade-offs

- [La allowlist no es un sandbox] → se documenta explícitamente; `node -e`,
  `python -c` y `git` pueden escribir archivos. El objetivo es evitar el borrado
  accidental y los comandos destructivos evidentes, no contener a un atacante.
- [Rechazar comandos compuestos rompe flujos legítimos] → el agente hace varias
  llamadas; se documenta en la descripción de la herramienta.
- [PowerShell 5.1 no soporta `&&`] → irrelevante al rechazar composición.
- [Sin CI de Windows, la ejecución real no se verifica] → se testea la lógica con
  `plataforma: 'win32'` y `ejecutor` inyectado; se anota la deuda de CI.
- [Un comando con comillas anidadas puede evadir el detector] → se documenta como
  limitación y se prefiere el rechazo conservador.
- [Cambiar el nombre de la tool rompe prompts guardados] → no hay sesiones
  persistentes en la v1; el impacto es nulo.

## Migration Plan

Al archivar, `openspec/specs/tools/spec.md` elimina el requisito anterior y agrega
«La herramienta de ejecución se resuelve contra el catálogo de cada plataforma»,
con lo que desaparece el escenario de «no disponible en Windows». Actualizar
`AGENTS.md` y `openspec/config.yaml` en el mismo change.
