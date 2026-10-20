# harness

Un coding agent de terminal: el modelo es el motor, el harness es el chasis. Lee
archivos, ejecuta herramientas, administra el contexto y se puede cancelar a
mitad de tarea.

La implementación corresponde a los 7 changes de `openspec/changes/`. El contrato
de comportamiento vive en `openspec/specs/` y las decisiones de trabajo en
`AGENTS.md`.

## Requisitos

- Node.js 24 o superior
- Linux, macOS o Windows

## Instalación

```bash
npm install
```

## Configuración

El harness lee `.harness/config.json`. Ese archivo está ignorado por git, igual
que `.env`. El ejemplo versionado es `.harness/config.example.json`.

```bash
cp .harness/config.example.json .harness/config.json
cp .env.example .env
```

Completá la credencial de una de estas dos formas:

- `variableApiKey`: el nombre de una variable de entorno, por ejemplo
  `OPENROUTER_API_KEY` en `.env`. Es la vía preferida.
- `apiKey`: el valor literal, solo en el `.harness/config.json` local ignorado.
  Nunca lo pongas en el ejemplo ni en un archivo versionado.

Cada modelo puede declarar `maxTokensSalida`. En OpenRouter conviene fijarlo
(por ejemplo, `1024`) para que la petición no reserve el máximo del modelo y sea
rechazada por crédito.

## Uso

```bash
# Pedido directo: corre el turno y termina
npm run dev -- "Leé package.json y decime el nombre del paquete"

# TUI interactiva (sin pedido inicial y con terminal)
npm run dev

# Elegir un modelo configurado
npm run dev -- --modelo openrouter/deepseek/deepseek-chat "Respondé hola"

# Otro directorio de proyecto
npm run dev -- --dir /ruta/al/proyecto "pedido"

# Ayuda
npm run dev -- --help
```

Dentro de la TUI:

- `Enter` envía el pedido.
- `/modelo` lista los modelos disponibles.
- `/modelo proveedor/modelo` cambia el modelo sin reiniciar ni perder el historial.
- `Ctrl+C` cancela el turno en curso; si no hay turno, sale.
- `Ctrl+D` sale.

Sin terminal interactiva no se abre la TUI: se lee el pedido de los argumentos o
de `stdin` y se escribe línea a línea. Los códigos de salida son `0` para un turno
completado y `1` para un fallo o un pedido ausente.

## Build y binario

```bash
npm run build      # compila a dist/
npm start          # ejecuta dist/main.js
npm run link       # construye y enlaza harness globalmente
```

## Calidad

```bash
npm run check      # lint + typecheck + tests
```

El proyecto sigue la regla de un test por escenario de los specs. Los tests
corren con Vitest y no necesitan una credencial real: el provider simulado y un
servidor HTTP local cubren el contrato.

## Seguridad

- No commitees `.harness/config.json` ni `.env`.
- Las herramientas `read`, `write`, `edit`, `grep` y `glob` rechazan `.env`,
  `.env.*` y `.harness/**`, así el modelo no puede leer la credencial.
- Los errores y resultados se sanean para redactar la credencial.
- La ejecución de comandos usa un catálogo por plataforma y rechaza comandos
  compuestos. En Windows usa PowerShell con allowlist; en Unix, lista negra.
- El camino de Windows está cubierto por tests unitarios, pero todavía no corrió
  en CI sobre Windows.
