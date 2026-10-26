# Spec Delta

## ADDED Requirements

### Requirement: El harness aplica un parche compuesto por bloques de intención
El sistema SHALL exponer una herramienta que reciba un parche formado por bloques y
aplique cada bloque sobre una ruta del proyecto. Cada bloque SHALL declarar una de
tres intenciones: agregar un archivo, actualizar un archivo o borrar un archivo. El
sistema SHALL rechazar como texto un parche vacío o un parche con un bloque
incompleto, sin modificar archivos.

#### Scenario: Un parche agrega un archivo
- **WHEN** el parche contiene un bloque de alta con su contenido
- **THEN** el sistema crea el archivo con ese contenido y lo informa en el resultado

#### Scenario: Un parche actualiza un archivo
- **WHEN** el parche contiene un bloque de actualización con líneas a quitar y a poner
- **THEN** el sistema modifica el archivo y lo informa en el resultado

#### Scenario: Un parche borra un archivo
- **WHEN** el parche contiene un bloque de borrado de un archivo existente
- **THEN** el sistema elimina el archivo y lo informa en el resultado

#### Scenario: Un parche sin bloques no modifica nada
- **WHEN** el modelo envía un parche vacío o sin bloques reconocibles
- **THEN** el sistema no modifica archivos y devuelve un mensaje de error

---

### Requirement: El parche se valida completo antes de escribir
El sistema SHALL verificar todos los bloques del parche antes de modificar el primer
archivo: rutas dentro del proyecto, existencia o inexistencia según la intención y
coincidencia de las líneas de actualización. Si un bloque no se puede aplicar, el
sistema SHALL NOT modificar ningún archivo y SHALL devolver un mensaje que identifique
el bloque y la causa.

#### Scenario: Un bloque inválido deja el resto intacto
- **WHEN** un parche tiene un bloque válido y otro cuya actualización no coincide
- **THEN** ningún archivo se modifica y el error identifica el bloque que falló

#### Scenario: Una ruta fuera del proyecto se rechaza
- **WHEN** un bloque apunta fuera del directorio del proyecto
- **THEN** el parche completo se rechaza y ningún archivo se modifica

#### Scenario: Agregar un archivo que ya existe falla
- **WHEN** un bloque declara agregar una ruta que ya existe
- **THEN** el parche completo se rechaza y el archivo existente no cambia

#### Scenario: Borrar un archivo inexistente falla
- **WHEN** un bloque declara borrar una ruta que no existe
- **THEN** el parche completo se rechaza y ningún archivo cambia

---

### Requirement: La actualización por bloques exige una coincidencia única
Para cada bloque de actualización, el sistema SHALL localizar la secuencia de líneas
de contexto y de eliminación en el archivo y SHALL aplicar el cambio solo cuando esa
secuencia aparezca exactamente una vez. El sistema SHALL NOT modificar el archivo
cuando la secuencia aparezca más de una vez y SHALL devolver cuántas coincidencias
encontró. El sistema SHALL NOT modificar el archivo cuando la secuencia no aparezca.
El sistema SHALL preservar el fin de línea original del archivo.

#### Scenario: La secuencia aparece una vez
- **WHEN** las líneas del bloque aparecen exactamente una vez en el archivo
- **THEN** el sistema aplica el cambio en ese lugar

#### Scenario: La secuencia aparece varias veces
- **WHEN** las líneas del bloque aparecen más de una vez en el archivo
- **THEN** el sistema no modifica el archivo e informa cuántas coincidencias encontró

#### Scenario: La secuencia no aparece
- **WHEN** las líneas del bloque no aparecen en el archivo
- **THEN** el sistema no modifica el archivo y devuelve un mensaje de error

#### Scenario: El fin de línea original se conserva
- **WHEN** el archivo usa un fin de línea distinto del nativo de la plataforma
- **THEN** el archivo actualizado conserva su fin de línea original

---

### Requirement: El parche declara su permiso y no admite ejecución en paralelo
La herramienta de parche SHALL declarar la acción de permiso de edición y SHALL
devolver como recurso el conjunto de rutas afectadas por el parche. La herramienta
SHALL NOT admitir ejecución en paralelo con otras llamadas de la misma tanda.

#### Scenario: El catálogo expone las rutas del parche
- **WHEN** el sistema prepara una llamada a la herramienta de parche
- **THEN** obtiene de la propia herramienta la acción de edición y todas las rutas declaradas

#### Scenario: El parche no se agrupa en una tanda
- **WHEN** el modelo pide un parche junto a otras herramientas en la misma tanda
- **THEN** el parche se ejecuta solo, sin compartir tanda con las demás
