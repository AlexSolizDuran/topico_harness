# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- El catálogo de herramientas ya incluye lectura, escritura, edición, búsqueda y
  ejecución. No hay una herramienta de lenguaje.
- El registro de herramientas es datos: nombre, esquema, acción de permiso,
  metadato de paralelo y ejecución.
- El portero evalúa acciones y recursos; la acción de leer ya existe, pero no
  distingue una operación de lenguaje.
- Los subagentes reciben solo herramientas de lectura declaradas en su definición.
- La interfaz muestra cada herramienta y su resultado; un diagnóstico puede viajar
  como resultado de herramienta.

## Goals / Non-Goals

**Goals:**

- Dar al agente inteligencia de código por símbolos en vez de solo texto.
- Cerrar el ciclo de edición con diagnósticos sin intervención humana.
- Degradar sin servidor sin romper el turno.
- Mantener la herramienta de solo lectura y compatible con subagentes.

**Non-Goals:**

- Empaquetar o instalar servidores de lenguaje.
- Diagnósticos de todo el workspace en cada paso.
- Reemplazar `grep` o `glob`: siguen siendo el fallback.
- MCP o herramientas externas.
- Implementar el comportamiento en `src/` o agregar tests en este change.

## Decisions

**Capacidad nueva `lsp`, no un requisito de `tools`.** El ciclo de vida de un
servidor, su configuración y sus operaciones son un contrato propio. `tools`
describe herramientas sin estado; `lsp` describe un servidor con estado y
diagnósticos.

**Solo lectura y apta para subagentes.** Todas las operaciones consultan, no
modifican. Puede entrar en la intersección de un subagente si su definición la
declara. Alternativa descartada: excluirla de subagentes, que perdería la ventaja
de investigar con símbolos.

**Los diagnósticos vuelven como resultado de herramienta, no como hook.** El
resultado de la edición puede incluir los diagnósticos del archivo modificado. Se
evita depender de un hook externo y el agente recibe el error en el mismo paso.
Alternativa descartada: un hook `postTool` obligatorio, que agrega configuración y
latencia para una capacidad que ya es del harness.

**Arranque bajo demanda y cierre al final.** Un servidor de lenguaje es caro en
memoria y tiempo. Se arranca la primera vez que se usa y se cierra al terminar la
sesión o el turno hijo. Sin esto, cada sesión deja procesos vivos.

**Degradación a texto, no a excepción.** Sin servidor, la operación devuelve un
error como texto. El modelo puede volver a `grep` y `glob`. Un servidor que no
arranca no debe bloquear la sesión.

**La acción de permiso es leer símbolos.** Usa la operación y el archivo como
recurso. Una regla `denegar` la bloquea; una `permitir` la ejecuta sin preguntar.
No es una aprobación obligatoria porque no modifica nada.

## Risks / Trade-offs

- [Configurar servidores es complejo] → La configuración declara lenguaje,
  comando y raíz; una entrada incompleta falla al arrancar con un mensaje claro.
- [El servidor consume memoria] → Arranque bajo demanda y cierre al terminar.
- [Diagnósticos ruidosos llenan el contexto] → Solo archivos modificados y
  resultado truncado con marcador.
- [Un servidor lento demora cada paso] → Se consulta después de editar, no en
  cada paso, y el fallo no bloquea.
- [El spec queda adelante del código] → El change de implementación y sus tests
  se derivan después; este change solo fija el contrato.

## Migration Plan

No hay migración. Sin servidores configurados, la capacidad no se activa y el
comportamiento actual sigue igual.
