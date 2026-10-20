# Diseño 020-provider

## Arquitectura

El módulo `src/provider/` se ubica en la base de la arquitectura (flechas hacia abajo). Expone una interfaz abstracta `Proveedor` que el módulo `core/` consumirá por inyección de dependencias.

```
src/types.ts                 <-- Tipos inter-módulos (Mensaje, EventoProveedor, ConteoTokens)
  ▲
src/provider/
  ├── types.ts               <-- Interfaces del proveedor y contratos de respuesta
  ├── credentials.ts         <-- Extracción segura y sanitización de credenciales
  ├── retry.ts               <-- Estrategia de reintentos con backoff exponencial
  ├── mock.ts                <-- Adaptador simulado para pruebas deterministas
  └── index.ts               <-- Exportaciones públicas del módulo
```

## Estructuras de Datos

### Eventos Internos del Proveedor
```ts
export type EventoProveedor =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'solicitud_herramienta'; id: string; nombre: string; argumentos: Record<string, unknown> }
  | { tipo: 'fin'; razon: 'completado' | 'interrumpido'; motivo?: string; tokens?: ConteoTokens };

export interface ConteoTokens {
  entrada: number;
  salida: number;
}
```

### Contrato del Proveedor
```ts
export interface PeticionProveedor {
  mensajes: Mensaje[];
  herramientas?: DefinicionHerramienta[];
  sistema?: string;
  limiteTokens?: number;
}

export interface Proveedor {
  readonly nombre: string;
  enviar(peticion: PeticionProveedor): AsyncGenerator<EventoProveedor, void, unknown>;
}
```

## Mecanismo de Reintentos y Backoff (`retry.ts`)
- **Errores transitorios:** Códigos HTTP 429 (Rate Limit) y 5xx (500, 502, 503, 504), o fallos de red (`ECONNRESET`, `ETIMEDOUT`).
- **Errores no transitorios:** 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found). Fallan de inmediato sin reintentar.
- **Parámetros:** 3 reintentos máximo, espera inicial de 500ms, factor multiplicador de 2x (500ms -> 1000ms -> 2000ms).
- **Inyección de `dormir`:** Permite pasar un mock de `sleep` en tests unitarios para verificar la espera creciente sin consumir tiempo real.

## Manejo de Credenciales (`credentials.ts`)
- La API key se obtiene exclusivamente de variables de entorno (`process.env`).
- Si falta la credencial requerida antes de hacer la llamada, se lanza un error descriptivo previo a enviar cualquier petición mal formada.
- Función sanitizadora `sanitizarTexto(texto: string, credenciales: string[]): string` que reemplaza cualquier ocurrencia de la clave por `[REDACTADO]`.
- En caso de errores de red o excepciones, el mensaje retornado es sanitizado para garantizar que jamás filtre tokens de autenticación ni encabezados de autorización.
