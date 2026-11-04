# Design: Arquitectura de Memoria Persistente

## 1. Estructura de Almacenamiento

- Directorio del proyecto: `.harness/memory/`
  - `index.md`: Lista o tabla Markdown de hechos aprendidos con ID, título/resumen, origen y fecha (ISO).
  - `<id>.md`: Detalle opcional diferido por cada entrada que requiera contexto extenso.
- Directorio de usuario (opcional): `~/.harness/memory/` o ruta configurada.
- Topes:
  - Archivo individual: 32 KiB por defecto.
  - Total de memoria: 64 KiB por defecto.
  - Una escritura que supere el tope falla explícitamente (`ErrorTopeMemoria`) nombrando archivo, tamaño y tope; nunca se trunca en silencio.

## 2. Bloque Inyectado en el Prompt de Sistema

- La memoria se formatea como bloque de sistema independiente:
  ```markdown
  # MEMORIA APRENDIDA DEL PROYECTO
  [Aviso: La memoria contiene hechos aprendidos en sesiones previas, no comprobados en este turno]
  - [2026-10-31 | origen: auth] La autenticación usa JWT con RS256 en lugar de HS256.
  ```
- Si hay memoria de usuario, se incluye una sección separada con marcador:
  ```markdown
  # MEMORIA DE USUARIO (Preferencias)
  - [Preferencia] Usar TypeScript estricto sin decorators.
  ```
- El conteo de tokens de la memoria se suma a los tokens de sistema del presupuesto de contexto. Si excede el espacio disponible, se reporta y aplica el pipeline sin truncar en silencio.

## 3. Extracción al Cerrar Sesión

- Función `extraerHechosDeSesion(mensajes: Mensaje[], extractorProveedor: Proveedor)`:
  - Invoca al modelo con prompt especializado para filtrar únicamente decisiones arquitectónicas, convenciones tácitas y errores descartados, ignorando pedidos obvios o hechos deducibles del código fuente.
  - Escritura atómica: se validan todos los archivos y topes antes de persistir (escribiendo a archivos temporales y renombrando atómicamente, o en transacción en memoria).
  - Fallo aislado: si la llamada falla o se produce un error, se captura y se emite un aviso, permitiendo que la sesión cierre limpiamente.

## 4. Curación y Carga Diferida

- `cargarDetalleMemoria(id: string)`: lee `.harness/memory/<id>.md` bajo demanda sin cargar todos los detalles al inicio.
- `detectarContradicciones(entradas: EntradaMemoria[])`: identifica entradas con la misma clave o tema contradictorio y marca la más antigua como superada/obsoleta.
