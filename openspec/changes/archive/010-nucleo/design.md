# Diseño 010-nucleo: Bucle de Ejecución del Agente

## Arquitectura y Módulos

```
src/types.ts                   <-- Tipos compartidos (Mensaje, EventoTurno, EstadoTurno)
  ▲
src/core/
  ├── registry.ts              <-- Registro dinámico de herramientas (datos, no switch)
  ├── history.ts               <-- Validación y construcción atómica del historial
  ├── dispatch.ts              <-- Validación de schemas y captura de errores como texto
  ├── turn.ts                  <-- Bucle principal del turno (async generator)
  └── index.ts                 <-- Exportaciones públicas del módulo core
```

## Estructuras y Tipos

### Estados del Turno
```ts
export type EstadoTurno =
  | { tipo: 'completado'; mensajes: Mensaje[]; pasosEjecutados: number }
  | { tipo: 'cancelado'; mensajes: Mensaje[]; pasosEjecutados: number }
  | { tipo: 'fallido'; motivo: string; mensajes: Mensaje[]; pasosEjecutados: number };
```

### Eventos del Núcleo
```ts
export type EventoTurno =
  | { tipo: 'texto'; delta: string }
  | { tipo: 'paso_inicio'; paso: number }
  | { tipo: 'herramienta_inicio'; id: string; nombre: string; argumentos: Record<string, unknown> }
  | { tipo: 'herramienta_fin'; id: string; nombre: string; resultado: string; esError: boolean }
  | { tipo: 'limite_pasos_alcanzado'; pasos: number };
```

## Registro de Herramientas (`registry.ts`)
- Las herramientas se almacenan en un `Map<string, EntradaHerramienta>`.
- Cada herramienta declara:
  - `nombre: string`
  - `descripcion: string`
  - `esquema: z.ZodType<any> | Record<string, unknown>`
  - `ejecutar: (args: any) => Promise<string>`
- Se evita cualquier condicional `switch(toolName)` en el loop, permitiendo agregar herramientas dinámicamente.

## Validación de Argumentos y Despacho (`dispatch.ts`)
1. Si los argumentos llegan como string JSON (`"{\"ruta\": \"test.ts\"}"`), se parsean con `JSON.parse`.
2. Se validan contra el esquema:
   - Si faltan campos requeridos, se retorna texto explicativo: `Error de validación: falta el argumento requerido '<campo>'`.
   - Si se proporcionan campos adicionales no declarados, se descartan silenciosamente para ser tolerantes con inventos del modelo.
3. Si la ejecución lanza una excepción inesperada:
   - Se captura con `try / catch`.
   - Se sanitiza para evitar filtrar credenciales de `process.env`.
   - Se formatea como texto de resultado: `ERROR: ${error.message}\nLa operación no se completó.`
   - Nunca se relanza la excepción hacia afuera del turno.

## Bucle del Turno (`turn.ts`)
- Parámetro `MAXIMO_PASOS = 25` por defecto.
- En cada paso:
  1. Verifica si la señal `AbortSignal` está abortada. Si lo está, termina inmediatamente con `{ tipo: 'cancelado' }`.
  2. Valida la atomicidad del historial antes de enviarlo.
  3. Invoca `proveedor.enviar({ mensajes, herramientas })`.
  4. Si el modelo no solicita herramientas, el turno concluye como `{ tipo: 'completado' }`.
  5. Si el modelo solicita herramientas, se despachan todas, se acumulan sus resultados y se añaden al historial.
  6. Si se alcanza `MAXIMO_PASOS` y el modelo sigue solicitando herramientas, se interrumpe y se devuelve el estado alcanzado con aviso de límite.
