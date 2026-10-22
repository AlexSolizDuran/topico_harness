# Spec Delta

## ADDED Requirements

### Requirement: El harness se inicia desde la terminal sobre el proyecto actual
El sistema SHALL iniciarse como un proceso de terminal desde el directorio del
proyecto. El sistema SHALL tomar ese directorio como raíz para resolver rutas. El
sistema SHALL aceptar un pedido inicial como argumentos de la invocación.

#### Scenario: Arranque en el directorio del proyecto
- **WHEN** la persona ejecuta el harness desde un directorio
- **THEN** el sistema opera sobre ese directorio y sus archivos

#### Scenario: Pedido inicial por argumentos
- **WHEN** la invocación incluye texto después del nombre del comando
- **THEN** el sistema inicia un turno con ese texto como primer pedido

#### Scenario: Sin pedido inicial en una terminal interactiva
- **WHEN** la invocación no incluye texto
- **THEN** el sistema queda a la espera de que la persona escriba
