# Proposal

## Why

`.harness/config.json` está ignorado por git porque puede llevar la credencial
literal. Eso tiene un costo que no se ve: todo lo que vive ahí —modelos, sesiones y
ahora los hooks— es personal. Quien clona el repo no lo tiene, y no hay forma de
compartir la configuración del proyecto sin mandarla por chat.

La credencial ya tiene un lugar propio: `.env`, ignorado y cargado con
`--env-file-if-exists`. Con la credencial fuera del config, el config puede
versionarse.

## What Changes

- `.harness/config.json` pasa a versionarse; se quita del `.gitignore`.
- El config del proyecto deja de aceptar `apiKey` literal: si aparece, el arranque
  falla con un mensaje que indica usar `variableApiKey` y `.env`.
- El config global (`~/.config/harness/config.json`) sigue aceptando `apiKey`
  literal: está fuera del repo y no se versiona.
- La credencial se resuelve desde la variable de entorno declarada en
  `variableApiKey`, que ya carga `.env`.
- Si la variable declarada falta, el error nombra la variable y menciona `.env`.
- El valor de la credencial nunca aparece en el mensaje de error.
- Fuera de alcance: capas de configuración adicionales, cifrado, gestores de
  secretos.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `provider`: el config del proyecto se versiona sin credencial literal y el error
  de credencial faltante indica dónde ponerla.

## Impact

- Código: `src/provider/config.ts` (validación y resolución).
- Configuración: `.gitignore`, `.harness/config.example.json`.
- Documentación: `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md`,
  `PREGUNTAS.md`.
- **Migración obligatoria antes de versionar**: mover la `apiKey` literal de
  `.harness/config.json` a `.env` y reemplazarla por `variableApiKey`. Si se
  versiona antes de migrar, la credencial queda en el historial.
- Sin dependencias nuevas.
