# Instalación de harness

## 1. Instalar

Requiere Node.js 24 o superior.

```bash
npm install -g topicos-harness-fds
harness --help
```

## 2. Configurar

El archivo de configuración es el mismo para Windows y Linux. Reemplazá
`PONER_OPENROUTER_KEY` y `PONER_GROQ_KEY` por tus claves.

```json
{
  "proveedorPorDefecto": "groq",
  "modeloPorDefecto": "openai/gpt-oss-120b",
  "proveedores": {
    "openrouter": {
      "tipo": "openai-compatible",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "PONER_OPENROUTER_KEY",
      "cabecerasExtra": {
        "HTTP-Referer": "https://example.com",
        "X-Title": "harness"
      },
      "modelos": [
        {
          "id": "openrouter/free",
          "soportaHerramientas": true,
          "ventanaContexto": 200000,
          "maxTokensSalida": 4096
        },
        {
          "id": "cohere/north-mini-code:free",
          "soportaHerramientas": true,
          "ventanaContexto": 256000,
          "maxTokensSalida": 4096
        },
        {
          "id": "google/gemma-4-26b-a4b-it:free",
          "soportaHerramientas": true,
          "ventanaContexto": 262144,
          "maxTokensSalida": 4096
        },
        {
          "id": "nvidia/nemotron-3-ultra-550b-a55b:free",
          "soportaHerramientas": true,
          "ventanaContexto": 1000000,
          "maxTokensSalida": 4096
        },
        {
          "id": "nvidia/nemotron-3.5-super-vl:free",
          "soportaHerramientas": true,
          "ventanaContexto": 1000000,
          "maxTokensSalida": 4096
        }
      ]
    },
    "groq": {
      "tipo": "openai-compatible",
      "baseUrl": "https://api.groq.com/openai/v1",
      "apiKey": "PONER_GROQ_KEY",
      "modelos": [
        {
          "id": "openai/gpt-oss-120b",
          "soportaHerramientas": true,
          "ventanaContexto": 131072,
          "maxTokensSalida": 4096
        },
        {
          "id": "openai/gpt-oss-20b",
          "soportaHerramientas": true,
          "ventanaContexto": 131072,
          "maxTokensSalida": 4096
        }
      ]
    },
    "ollama": {
      "tipo": "openai-compatible",
      "baseUrl": "http://localhost:11434/v1",
      "modelos": [
        {
          "id": "qwen2.5-coder:7b",
          "soportaHerramientas": true,
          "ventanaContexto": 32768,
          "maxTokensSalida": 2048
        }
      ]
    }
  }
}
```

### Linux / macOS

```bash
mkdir -p ~/.config/harness
nano ~/.config/harness/config.json
```

Pegá el JSON, reemplazá las claves y guardá con `Ctrl+O`, `Enter`, `Ctrl+X`.

Ver el archivo:

```bash
cat ~/.config/harness/config.json
```

Proteger:

```bash
chmod 600 ~/.config/harness/config.json
```

### Windows (PowerShell)

```powershell
New-Item -ItemType Directory -Force "$env:APPDATA\harness"
notepad "$env:APPDATA\harness\config.json"
```

Pegá el JSON, reemplazá las claves y guardá.

Ver el archivo:

```powershell
Get-Content "$env:APPDATA\harness\config.json"
```

## 3. Probar

```bash
harness "Respondé exactamente: OK"
```

## Notas

- El proveedor por defecto es Groq. Si solo usás OpenRouter, cambiá:

```json
"proveedorPorDefecto": "openrouter",
"modeloPorDefecto": "cohere/north-mini-code:free"
```

- Para usar `openrouter/free` de forma explícita:

```bash
harness --modelo openrouter/openrouter/free "Respondé solo: OK"
```
