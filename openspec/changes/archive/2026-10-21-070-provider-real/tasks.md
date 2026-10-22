# Tasks

## 1. Contrato interno y configuración

- [x] 1.1 Agregar `modelo` y las capacidades (`soportaHerramientas`, `ventanaContexto`) a `PeticionProveedor` o al provider en `src/provider/types.ts`; verificar que `npm run typecheck` pasa.
- [x] 1.2 Implementar `cargarConfig()` en `src/provider/config.ts` con merge de config global y de proyecto; verificar con tests de archivo válido, ausente y JSON inválido.
- [x] 1.3 Aceptar `apiKey` literal solo en `.harness/config.json` ignorado y documentar `variableApiKey` como vía preferida; verificar que el ejemplo versionado no contiene el valor.

## 2. Transporte SSE

- [x] 2.1 Implementar `leerSSE(cuerpo)` en `src/provider/sse.ts` acumulando líneas y devolviendo payloads; verificar con un test de payload partido entre chunks.
- [x] 2.2 Manejar líneas `data: [DONE]`, comentarios `:` y líneas vacías; verificar que no se emiten payloads basura.

## 3. Adaptador y factory

- [x] 3.1 Implementar `crearProveedorOpenAICompatible` con traducción de mensajes, herramientas y `system`; verificar con el servidor falso que el body enviado coincide con el esperado.
- [x] 3.2 Traducir `delta.content` a eventos `texto` y reconstruir `tool_calls` por `index`; verificar con una tool call partida en tres deltas.
- [x] 3.3 Emitir `fin` con la razón y los tokens de `usage`; verificar que el turno termina sin llamadas pendientes.
- [x] 3.4 Mapear errores HTTP a `ErrorProveedor` con `codigoEstado` y `esTransitorio`, y pasar por `ejecutarConReintentos`; verificar 429 y 500 reintentan, 400 no.
- [x] 3.5 Implementar `crearProveedor(config)` en `src/provider/factory.ts` con un `Map` por `tipo`; verificar que un `tipo` desconocido devuelve un error claro.
- [x] 3.6 Respetar `soportaHerramientas: false` no enviando `tools`; verificar en el body capturado por el servidor falso.

## 4. Suite de contrato

- [x] 4.1 Crear `tests/provider/openai-compatible.test.ts` con un servidor HTTP local y SSE guionado; verificar que corre contra el adaptador real.
- [x] 4.2 Cubrir texto fragmentado, tool call, fin, 429, 500, 400, credencial faltante, sanitización de la key y `AbortSignal`; verificar cada caso como test separado.

## 5. Integración y documentos

- [x] 5.1 Conectar el adaptador a `construirHarness()` cuando la config lo indique; verificar un turno de punta a punta contra el servidor falso.
- [x] 5.2 Escribir un `.env.example` con `DEEPSEEK_API_KEY` y un `config.json` de ejemplo; verificar que ninguno contiene un secreto real.
- [x] 5.3 Documentar en `AGENTS.md` cómo agregar un modelo (config) y un adaptador (archivo + factory); verificar que los pasos coinciden con el código.
- [x] 5.4 Correr `npm run check` y verificar lint, typecheck y tests en verde.
