# Documentación del producto — Plataforma de Gestión de Convocatorias

Especificación funcional y técnica del MVP **v6** (septiembre 2026). Es la fuente de verdad del producto: si el código y estos documentos se contradicen, gana el documento (o se actualiza el documento explícitamente).

## Cómo está organizado

| Archivo | Contenido | Cuándo leerlo |
|---|---|---|
| [`00-contexto-y-alcance.md`](00-contexto-y-alcance.md) | Objetivo, decisiones de alcance, qué está fuera del MVP, actores, métricas de éxito | Al empezar cualquier cosa |
| [`01-casos-de-uso.md`](01-casos-de-uso.md) | CU-01 a CU-40 con actor, precondiciones, flujo principal, flujos alternos y postcondiciones. Ciclos de vida de cada objeto | Antes de implementar una pantalla o un flujo |
| [`02-requerimientos-funcionales.md`](02-requerimientos-funcionales.md) | RF-01 a RF-83 con prioridad MoSCoW y trazabilidad al caso de uso | Para saber qué debe hacer exactamente el sistema |
| [`03-requerimientos-no-funcionales.md`](03-requerimientos-no-funcionales.md) | RNF-01 a RNF-34 con criterio de verificación, y las 30 reglas de negocio | Seguridad, rendimiento, veracidad de la IA, validaciones |
| [`04-arquitectura.md`](04-arquitectura.md) | Cinco capas, rutas de los tres portales, servicios y endpoints, decisión de plataforma | Al crear rutas, endpoints o middlewares |
| [`05-modelo-de-datos.md`](05-modelo-de-datos.md) | Las 27 tablas con sus columnas y restricciones, índices, políticas RLS, SQL de compatibilidad, jobs de pg_cron | Al tipar datos, crear migraciones o consultas |
| [`06-procesos-de-negocio.md`](06-procesos-de-negocio.md) | Procesos core (no se tercerizan) y no core | Decisiones de priorización |
| [`07-modelo-de-negocio.md`](07-modelo-de-negocio.md) | Planes, precios en COP, créditos de IA (solo planes de empresa), benchmark y análisis competitivo | Pantallas de suscripción y cupos |
| [`08-roadmap.md`](08-roadmap.md) | Scrum, cronograma de 18 semanas con hitos, y las fases E1–E10 posteriores al MVP | Planeación y para no construir cosas de fases futuras |
| [`09-trazabilidad.md`](09-trazabilidad.md) | Matriz CU ↔ RF ↔ RNF/RN | Para verificar cobertura |
| [`10-plan-de-desarrollo.md`](10-plan-de-desarrollo.md) | **Plan de 30 días**: Scrum adaptado a una persona y un agente, ritual de sesión, definición de terminado y los cinco sprints con sus hitos | Al empezar un sprint, o si hay dudas sobre qué toca |
| [`11-avance-por-requerimiento.md`](11-avance-por-requerimiento.md) | Estado de implementación de los 83 RF, 34 RNF y las reglas pendientes: `pendiente` · `prototipo` · `servidor` · `verificado` | Para saber qué está hecho de verdad y qué falta |
| [`bitacora/`](bitacora/) | Una entrada por sesión: qué se hizo, cómo se verificó, qué se decidió y qué quedó abierto | Al abrir sesión, la última entrada |
| [`99-especificacion-completa.md`](99-especificacion-completa.md) | Todo lo anterior en un solo archivo, **salvo `10`, `11` y `bitacora/`**, que son registros vivos del desarrollo y no parte de la especificación | Solo si necesitas leerlo de corrido o exportarlo |

`diagramas/` contiene las versiones en PNG de la arquitectura y del modelo de datos (todavía de v4).

El **estado vivo del trabajo** no está en esta carpeta sino en [`../ESTADO.md`](../ESTADO.md), en la raíz del repositorio.

[`INSTRUCCIONES-INSTALACION.md`](INSTRUCCIONES-INSTALACION.md) explica cómo levantar el proyecto en local.

## Cómo citar

Usa siempre los identificadores: `CU-33` (generar documento con IA), `RF-57` (marcar pendientes), `RNF-23` (veracidad), `RN-17` (créditos). Están enlazados entre documentos y evitan ambigüedad al pedir cambios.

## Al modificar el producto

Cuando una decisión cambie el comportamiento del sistema, actualiza primero el documento correspondiente y después el código. Si agregas un caso de uso o requerimiento, continúa la numeración y añádelo a `09-trazabilidad.md`.
