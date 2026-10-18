# Diseño 030-tools: Catálogo de Herramientas

## Arquitectura del Módulo

```
src/tools/
  ├── path.ts       <-- Resolución y validación de rutas seguras dentro del proyecto
  ├── truncate.ts   <-- Lógica de truncado de salida (30.000 caracteres por defecto)
  ├── read.ts       <-- Herramienta `read` con lectura por tramos
  ├── write.ts      <-- Herramienta `write` para creación y sobrescritura
  ├── edit.ts       <-- Herramienta `edit` con validación de ocurrencia única
  ├── glob.ts       <-- Herramienta `glob` para búsqueda de archivos por patrón
  ├── grep.ts       <-- Herramienta `grep` para búsqueda de texto en archivos
  ├── shell.ts      <-- Herramienta `bash` con catálogo y lista negra por plataforma
  ├── catalog.ts    <-- Ensamblado del catálogo según la plataforma activa
  └── index.ts      <-- Exportaciones públicas del módulo
```

## Reglas de Implementación

### Rutas Seguras (`path.ts`)
- Todas las rutas recibidas se normalizan (`/` y `\`).
- Se resuelven con `path.resolve(directorioProyecto, ruta)`.
- Se valida que la ruta resultante comience estrictamente con `directorioProyecto`. Si sale del directorio (por ejemplo, con `../../`), se lanza un error y se rechaza la operación.

### Truncado de Salida (`truncate.ts`)
- Límite por defecto: `TRUNCADO_POR_DEFECTO = 30000` caracteres.
- Si la longitud supera el límite, se corta y se agrega: `\n\n[Contenido truncado. Se mostraron 30000 de N caracteres]`.

### Herramienta `edit.ts`
- Se cuenta el número exacto de apariciones del fragmento `buscar`.
- Si `ocurrencias === 1`: realiza el reemplazo y guarda.
- Si `ocurrencias > 1`: rechaza sin modificar e informa: `El texto a reemplazar aparece ${n} veces. Debe ser único.`
- Si `ocurrencias === 0`: rechaza sin modificar e informa que no se encontró el texto.

### Catálogo y Lista Negra de Comandos (`shell.ts`)
- **En Windows:** La herramienta `bash` no se registra en el catálogo de herramientas disponibles para el modelo.
- **En Linux / macOS:** Se verifica el comando contra la lista negra:
  - Bloqueados: `rm`, `rmdir`, `unlink`, `shred`, `mkfs`, `dd`, `chmod`, `chown`, `chgrp`, `sudo`, `su`, `doas`, `mount`, `umount`, `kill`, `killall`, `pkill`, `shutdown`, `reboot`, `halt`, `poweroff`.
  - La comprobación se hace sobre el nombre base del comando (primer token), sin importar flags ni orden de opciones.
  - Si el comando termina con código de error (distinto de 0), devuelve la salida y código de retorno como texto sin lanzar excepción.
