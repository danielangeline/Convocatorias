# Sesión 040 · 2026-11-10 (Fase 6)

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)

## Objetivo de la sesión

Fase 6 del rediseño FundRadar: panel administrador (`app/admin/*`).

## Qué se hizo

Presentación; la autorización (404 a quien no es administrador, MFA aal2), los endpoints y la lógica no cambian (CU-02, CU-04, CU-25, CU-37, RF-34, RF-42, RF-65, RF-90, RF-108, RN-31, RNF-28, RNF-30).

- **Panel general** (`DashboardPanel`): primero «Requiere tu atención» con tarjetas clicables de borde ámbar y número mono (perfiles en revisión, solicitudes sin asignar, borradores sin documentos), después la franja de 4 KPI, las barras semanales (la última en `pri`) y la barra segmentada de suscripciones con su leyenda.
- **Listados**: `DataTable` ahora se ve como tarjetas por debajo de 768 px (primera columna como título, el resto «etiqueta: valor»). Las seis tablas propias del panel (fuentes, planes, suscripciones, tasas, seguridad, consultores) se envolvieron en `TablaTarjetas` (CSS + etiquetas tomadas del encabezado) y hacen lo mismo. Nuevo `ChipsEstado` (chips con contador en mono) en Convocatorias.
- **Editor de convocatoria**: pasos numerados (Datos generales · Categorías · Documentos · Requisitos) con navegación fija, secciones numeradas, rejilla `auto-fit minmax(200px,1fr)` y pie fijo con «Cerrar» y «Guardar y seguir» (`guardar()` ahora informa si guardó para avanzar solo si salió bien).
- **Perfiles en revisión** (`BandejaRevision`): lista a la izquierda y detalle a la derecha con checklist de revisión (✓/✗), «Aprobar y publicar» y «Rechazar y pedir cambios» (con `ModalMotivo`).
- **Consumo de IA**: franja de KPI y tarifas editables en mono. Entradas del panel a 44 px con borde `line-strong`.

## Cómo se verificó

`tsc` limpio, `npm run lint` 0 errores, `npm run build` compila. En el navegador (build de producción local, administrador temporal `416610` con MFA, ya borrado): panel general en oscuro, listado de convocatorias con chips y contadores, editor con pasos y pie fijo, y a 390 px el listado y Fuentes como tarjetas con hamburguesa. Sin errores de consola.

## Decisiones tomadas

- **El editor no es un Drawer de 640 px**: sigue en su ruta `/admin/convocatorias/[id]` (columna de 760 px). Un drawer sobre el listado exige rutas interceptadas o mover el editor al listado; se descartó por riesgo sobre la edición, publicación y adjuntos ya verificadas. Los pasos son anclas de la misma página, no pantallas.
- **«Pedir cambios» y «Rechazar» son uno solo** («Rechazar y pedir cambios»): en este producto el rechazo siempre permite corregir y reenviar (CU-25), no hay rechazo definitivo.
- **Sin paso «Montos y fechas»**: la ficha los trae dentro de Datos generales; separarlos exige partir ese bloque.
- **Barras semanales**: las que no son la última usan una mezcla de `pri` con la superficie en vez de `pri-soft` puro, que en oscuro casi no se ve.
- Sin «guardado hace 1 min» en el editor (no hay hora de guardado confiable en el cliente sin impureza).

## Qué quedó abierto

- Probar con datos reales las bandejas con perfiles en revisión y solicitudes al equipo (la cuenta temporal no tenía ninguna).
- Pantallas del panel sin rediseño propio: Planes, Suscripciones, Plantillas, Seguridad, Administradores, Categorías, Tasas y la carga masiva (solo reciben tokens, entradas y la vista de tarjetas en móvil).
- Hallazgo: con `next dev` ya corriendo en el puerto 3000, un `npm run build` en paralelo lo dejó en un bucle de recarga; para verificar se usó `next start` en otro puerto.
- Hallazgo: hay una carpeta `tmp-carga/` sin rastrear con consultas a Grants.gov que no es de esta sesión.

## Estado al cerrar

Las seis fases del rediseño están hechas. Falta la revisión del Product Owner y fusionar a `main`.
