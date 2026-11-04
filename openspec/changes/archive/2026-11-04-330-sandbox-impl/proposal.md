# Proposal: 330-sandbox-impl

## Why
El spec `sandbox` garantiza el aislamiento a nivel del sistema operativo para las ejecuciones de comandos (`shell`), restringiendo escrituras únicamente al proyecto y a directorios temporales efímeros, reportando de forma transparente y sin fingir cuando una plataforma no ofrece soporte (degradación visible con aviso claro, como en Windows), y devolviendo intentos de escape como texto de error sin tirar excepciones ni abortar el turno.

## What Changes
Implementar el módulo `src/sandbox/` conforme a `openspec/specs/sandbox/spec.md`:
1. Detección de mecanismos de sandbox por plataforma (ej. `bwrap` en Linux, `sandbox-exec` en macOS, o degradación documentada en Windows/sin binario).
2. Aislamiento por herramienta (`shell`) que confina escrituras a la raíz del proyecto y a un directorio temporal efímero.
3. Gestión del ciclo de vida del directorio temporal (creación y limpieza garantizada al finalizar o cancelar).
4. Formateo y captura de violaciones de aislamiento / intentos de escape devolviéndolos como texto al modelo.
5. Transparencia: metadatos de aislamiento (`aislado: false`, `motivoDegradacion`) y avisos visibles sin fingir cuando el sandbox está deshabilitado o no disponible.
