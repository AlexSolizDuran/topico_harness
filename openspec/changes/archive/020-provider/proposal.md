# Propuesta 020-provider: Capa Agnóstica de Proveedores y Adaptador

## Motivación y Contexto
El harness necesita comunicarse con modelos de lenguaje sin acoplarse a los tipos, SDKs o particularidades de formato de ningún proveedor específico. Siguiendo el spec formal de `provider` (`openspec/specs/provider/spec.md`), este change implementa el contrato unificado de interacción, la lectura segura de credenciales, el traductor de eventos, el mecanismo de reintentos exponenciales para fallos transitorios y el conteo normalizado de tokens.

## Requisitos de `openspec/specs/provider/spec.md` implementados
1. **El sistema expone una interfaz de provider agnóstica del modelo concreto**
2. **Los eventos del provider se traducen a eventos internos**
3. **El sistema reintenta ante fallos transitorios con espera creciente**
4. **La credencial se lee del entorno y nunca se expone**
5. **El sistema expone el conteo de tokens que reporta el provider**
6. **El fin de la respuesta distingue entre terminado e interrumpido**

## Alcance
- Definición de tipos compartidos en `src/types.ts` (`Mensaje`, `EventoProveedor`, `ConteoTokens`).
- Interfaz agnóstica `Proveedor` y tipos del dominio en `src/provider/types.ts`.
- Lógica de reintentos con backoff exponencial (`src/provider/retry.ts`).
- Sanitización de credenciales y registros (`src/provider/credentials.ts`).
- Implementación de adaptador de streaming agnóstico y mock/cliente HTTP (`src/provider/anthropic.ts` o adaptador estándar).
- Suite de pruebas completa en `tests/provider/` con exactamente 1 test por cada uno de los 17 escenarios normativos.
