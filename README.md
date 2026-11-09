# harness

Un coding agent de terminal: el modelo es el motor, el harness es el chasis. Lee
archivos, ejecuta herramientas, administra el contexto y se puede cancelar a
mitad de tarea.

La implementación cubre las 16 capacidades y corresponde a los 44 changes
archivados en `openspec/changes/archive/`. El contrato de comportamiento vive en
`openspec/specs/` y las decisiones de trabajo en `AGENTS.md`.

## Requisitos

- Node.js 24 o superior
- Linux, macOS o Windows

## Instalación

Requiere Node.js 24 o superior.

```bash
npm install -g topicos-harness-fds
harness --help
```

Para desarrollo dentro del repositorio: `npm install` y `npm run dev`.

## Configuración

Creá el config global:

- Linux/macOS: `~/.config/harness/config.json`
- Windows: `%APPDATA%\harness\config.json`

```json
{
  "proveedorPorDefecto": "openrouter",
  "modeloPorDefecto": "openai/gpt-4o-mini",
  "proveedores": {
    "openrouter": {
      "tipo": "openai-compatible",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "PONER_API_KEY",
      "modelos": [
        {
          "id": "openai/gpt-4o-mini",
          "soportaHerramientas": true,
          "ventanaContexto": 128000,
          "maxTokensSalida": 4096
        }
      ]
    }
  }
}
```

Reemplazá `PONER_API_KEY` por tu clave y protegé el archivo:

```bash
chmod 600 ~/.config/harness/config.json
```

`apiKey` literal solo se acepta en el config global. Si preferís no guardar la
clave en el JSON, usá `variableApiKey` y definí la variable en `.env` o en el
entorno. El config del proyecto (`.harness/config.json`) pisa al global. El
ejemplo completo está en `.harness/config.example.json`.

## Uso

Con la instalación global, reemplazá `npm run dev --` por `harness`.

```bash
# Pedido directo: corre el turno y termina
npm run dev -- "Leé package.json y decime el nombre del paquete"

# TUI interactiva (sin pedido inicial y con terminal)
npm run dev

# Elegir un modelo configurado
npm run dev -- --modelo openrouter/deepseek/deepseek-chat "Respondé hola"

# Elegir el agente inicial (build o plan)
npm run dev -- --agente plan "Analizá la arquitectura del proyecto"

# Otro directorio de proyecto
npm run dev -- --dir /ruta/al/proyecto "pedido"

# Ayuda
npm run dev -- --help
```

Dentro de la TUI:

- `Enter` envía el pedido (`Shift+Enter` o `Ctrl+J` inserta salto de línea).
- `Tab` alterna entre los agentes primarios (`build` y `plan`).
- `/agente` abre el selector de agentes o cambia directo con `/agente <nombre>`.
- `/modelo` lista los modelos disponibles o cambia con `/modelo proveedor/modelo`.
- `/contexto` muestra el panel de presupuesto y métricas de tokens.
- Cuando una herramienta requiere aprobación (`consultar`), aparece el panel interactivo (`[1/y]` aprobar una vez, `[2/a]` aprobar siempre, `[3/n/Esc]` denegar).
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
npm pack           # construye y genera topicos-harness-fds-<version>.tgz
npm publish        # publica topicos-harness-fds en npm
```

## Calidad

```bash
npm run check      # lint + typecheck + tests
```

El proyecto sigue la regla de un test por escenario de los specs. Hoy `npm run
check` pasa con 628 tests. Los tests corren con Vitest y no necesitan una
credencial real: el provider simulado y servidores locales falsos cubren el
contrato, incluidos LSP y MCP.

## Seguridad

- No commitees `.harness/config.json` ni `.env`. El config global con `apiKey`
  literal vive fuera del repo.
- Leer o escribir `.env`, `.env.*` o una ruta dentro de `.harness/` pide
  aprobación obligatoria; `.env.example` queda exceptuado.
- Los errores y resultados se sanean para redactar la credencial.
- La ejecución de comandos usa un catálogo por plataforma. Lo riesgoso (fuera del
  catálogo o de la lista negra, composición, redirecciones, código de un
  intérprete) pide aprobación obligatoria y nunca se omite por una regla
  `permitir`. En Windows usa PowerShell con allowlist; en Unix, lista negra.
- El camino de Windows está cubierto por tests unitarios, pero todavía no corrió
  en CI sobre Windows.
