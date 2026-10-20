# Diseño 040-interface: Interfaz de Usuario y Terminal

## Arquitectura de la Interfaz

La interfaz se ubica en la cima de la jerarquía (flecha hacia abajo hacia `core/`). Nunca contiene lógica de negocio ni manipula datos internamente: solo reacciona a los eventos emitidos por el generador `ejecutarTurno`.

```
src/interface/
  ├── state.ts        <-- Modelo y reductor de estado visual de la sesión
  ├── plain.ts        <-- Renderizador línea a línea para entornos sin TTY
  ├── app.tsx         <-- Componentes Ink para renderizado dinámico en terminal interactiva
  ├── runner.ts       <-- Orquestador de la sesión (detección de TTY, input y cancelación)
  └── index.ts        <-- Exportaciones públicas del módulo
```

## Componentes y Responsabilidades

### 1. Estado Visual (`state.ts`)
Mantiene los datos visuales de la sesión:
- `promptSistema: string` (persistente, inmutable)
- `historial: ElementoHistorialVisual[]`
- `textoStreaming: string`
- `turnoActivo: boolean`
- `turnoCancelado: boolean`

### 2. Modo No Interactivo / Degradación Línea a Línea (`plain.ts`)
Cuando `process.stdout.isTTY` es falso (ej. pipelines `|`, redirección a archivo `> salida.log` o entornos CI sin pseudo-terminal):
- Emite líneas secuenciales simples sin caracteres de escape ANSI de cursor.
- Formato claro:
  - `[Sistema] <prompt>`
  - `[Usuario] <mensaje>`
  - `[Asistente] <texto>`
  - `[Herramienta: <nombre>] <resultado>` (con etiquetas `[ERROR]` o `[TRUNCADO]`)
  - `[Turno cancelado]`

### 3. Modo Interactivo con Ink (`app.tsx`)
- Utiliza Ink 7 + React 19.
- Muestra el prompt de sistema anclado en la parte superior.
- Muestra el texto del asistente fluyendo en tiempo real.
- Bloquea el campo de entrada (`<TextInput>`) mientras un turno está en curso.
- Permite pulsar `Ctrl+C` o tecla de escape para cancelar el `AbortController` asociado al turno activo.
