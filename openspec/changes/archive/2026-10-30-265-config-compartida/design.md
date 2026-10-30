# Design

## Context

Ver `proposal.md — Why`. El estado actual que condiciona el diseño:

- `cargarConfig` mergea dos capas: global (`~/.config/harness/config.json`) y
  proyecto (`.harness/config.json`), con el proyecto pisando al global.
- `credencialDeProveedor` resuelve `variableApiKey` desde el entorno y cae a
  `apiKey` literal si la variable no está.
- `.env` ya está en `.gitignore` y `dev`/`start` corren con
  `node --env-file-if-exists=.env`, así que la variable llega a `process.env` sin
  cargar nada a mano.
- `.harness/*` ya es ruta sensible para las tools: `config.json` y `.env` están
  protegidos sin cambios.
- `.gitignore` ya tiene precedente de excepción versionada:
  `!.harness/agents.json`.

## Goals / Non-Goals

**Goals:**

- Que el config del proyecto se pueda versionar sin que la credencial viaje.
- Que la regla la haga cumplir el loader, no la memoria de quien commitea.
- No romper a quien ya usa `apiKey` en el config global.

**Non-Goals:**

- Capas adicionales de configuración (`config.local.json`).
- Gestores de secretos o cifrado.
- Cambiar la precedencia entre global y proyecto.

## Decisions

**Rechazar, no advertir.** Un `apiKey` en el config del proyecto es un error de
arranque, no un aviso. Un aviso se ignora y la credencial termina en el historial.
Alternativa descartada: advertir y seguir, que deja la fuga a un `git add` de
distancia.

**La restricción aplica al config del proyecto, no al global.** El global vive
fuera del repo y no se versiona; prohibirlo ahí sería castigar un uso legítimo.
Alternativa descartada: eliminar `apiKey` del esquema, que rompe configuraciones
existentes sin ganar seguridad.

**La validación ocurre en `leerConfig`, con la ruta en la mano.** El validador ya
recibe la ruta del archivo; alcanza con saber si es el del proyecto. Alternativa
descartada: validar en `cargarConfig`, que tendría que distinguir capas después de
mergear y ya no sabría de dónde vino cada proveedor.

**El mensaje nombra la variable y `.env`, nunca el valor.** Es la misma regla de
sanitización que ya rige los errores del provider.

**La migración va antes que el cambio de `.gitignore`.** Si se versiona primero, la
credencial queda en el historial y sacarla requiere reescribirlo. El orden de las
tareas lo refleja.

## Risks / Trade-offs

- [Alguien versiona el config antes de migrar] → La tarea de migración es la primera del change y se verifica con `git diff --cached` antes de cualquier commit.
- [Un equipo comparte un config con `cabecerasExtra` personales] → Es configuración del proyecto; lo personal va en el global, que pisa el proyecto.
- [El error de arranque sorprende a quien tenía `apiKey` local] → El mensaje dice exactamente qué hacer y el cambio está documentado en `AGENTS.md`.

## Migration Plan

1. Copiar el valor de `apiKey` de `.harness/config.json` a `.env` como
   `OPENROUTER_API_KEY=...`.
2. Reemplazar `apiKey` por `variableApiKey: "OPENROUTER_API_KEY"` en
   `.harness/config.json`.
3. Recién entonces quitar `.harness/config.json` del `.gitignore`.
4. Verificar que `git diff --cached` no muestre ninguna credencial.

Para volver atrás alcanza con restaurar `apiKey` en el config del proyecto y
devolver el archivo al `.gitignore`.
