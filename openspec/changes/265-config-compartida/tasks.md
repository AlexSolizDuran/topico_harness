# Tasks

## 1. Migración de la credencial

- [ ] 1.1 Copiar el valor de `apiKey` de `.harness/config.json` a `.env` como `OPENROUTER_API_KEY` y reemplazar `apiKey` por `variableApiKey`; verificar que `npm run dev` arranca y que `git diff` no muestra ninguna credencial.
- [ ] 1.2 Confirmar que `.env` sigue ignorado y que `.env.example` documenta la variable; verificar con `git check-ignore .env`.

## 2. Validación del config

- [ ] 2.1 Rechazar `apiKey` en el config del proyecto desde `leerConfig`, con un mensaje que indique `variableApiKey` y `.env`; verificar que el arranque falla y que el mensaje no incluye el valor.
- [ ] 2.2 Mantener `apiKey` aceptada en el config global; verificar el escenario de credencial desde el global.
- [ ] 2.3 Nombrar la variable faltante y mencionar `.env` cuando `variableApiKey` no existe en el entorno; verificar el escenario de credencial faltante.

## 3. Versionado

- [ ] 3.1 Agregar `!.harness/config.json` al `.gitignore` y actualizar el comentario del bloque; verificar con `git status` que el archivo aparece como versionable.
- [ ] 3.2 Alinear `.harness/config.example.json` con la forma versionada; verificar que no contiene credenciales.

## 4. Cierre

- [ ] 4.1 Actualizar `AGENTS.md`, `openspec/config.yaml`, `docs/comportamiento.md` y `PREGUNTAS.md` con la regla nueva; verificar que describen `.env` como fuente de la credencial.
- [ ] 4.2 Ejecutar `npm run check` y `openspec validate --all`; verificar que ambos terminan en verde.
- [ ] 4.3 Archivar el change con `openspec archive`; verificar que `openspec list` no muestra changes activos.
