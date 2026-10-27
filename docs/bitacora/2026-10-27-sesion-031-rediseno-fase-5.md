# Sesión 031 · 2026-10-27 · Rediseño visual, fase 5 (panel administrativo)

**Sprint:** 5 · día 13 de 30

## Objetivo de la sesión

Fase 5 del rediseño. A mitad de la fase el Product Owner mandó la captura del panel general: «la de admin también debe tener esto así».

## Qué se hizo

- **Dashboard (RF-42, RF-34, RF-90) con datos reales**: antes leía el store de ejemplo para convocatorias, suscripciones e IA. `lib/admin/tablero.ts` lee con la sesión del administrador:
  - KPI **Publicadas** (vigentes, «+N este mes» por `publicada_at`), **Borradores** («N sin documentos adjuntos»), **Cierran en < 15 días** y **Suscripciones activas** («Conversión de prueba: X %» = cuentas con plan pagado entre las que tienen suscripción).
  - **Postulaciones iniciadas** por semana (12 barras por `postulaciones.creada_at`, con la variación frente a las 12 anteriores cuando hay base).
  - **Suscripciones por estado** (`tablero_suscripciones`) en barra segmentada.
  - **Perfiles en revisión** con aprobar y rechazar en línea (`components/admin/PerfilesEnRevision.tsx`, mismos endpoints que la bandeja; el rechazo pide motivo, RN-13).
  - **Cierran en menos de 15 días** y **Consumo de IA del mes** (generaciones, ajustes, fallidas y costo estimado en USD).
  - Si hay solicitudes al equipo (RF-90), un aviso encima de los indicadores.
- **RF-108 (nuevo): `/admin/consumo-ia`** con los indicadores del mes y los últimos 200 consumos de `consumos_ia` (RF-52), con pestañas por resultado. Documentado en docs/02, 04, 09 y 11.
- **Menú del panel como la captura:** grupo «Catálogo», «Plantillas» y el ítem nuevo «Consumo de IA».
- **Convocatorias del panel:** `PageHeader`, pestañas por estado con su conteo y `DataTable`, con el chip de días cuando una publicada cierra en menos de 15.
- `Tabs`: sin barra de desplazamiento vertical espuria.

## Cómo se verificó

Administrador temporal con TOTP y una consultora puesta en revisión (`scripts/cuentas-recorrido.mjs`, ya borrados), contra producción local: dashboard en claro (11 publicadas, +11 este mes, 5 cierran en menos de 15 días, 4 en prueba, consumo de octubre 69/89/13/USD 0,86); **aprobación en línea**: el perfil salió de la tarjeta; `/admin/consumo-ia` y `/admin/convocatorias` en oscuro; el editor muestra tipo y origen guardados (BNEF: fondo, privado). Pruebas: `prueba-matriz-roles.mjs` TODO PASÓ, `prueba-revision-consultores.mjs` y `prueba-planes-suscripciones.mjs` TODO PASA. `tsc`, `eslint` y build limpios. El primer intento del dashboard falló en el servidor: la columna es `creada_at`, no `creado_at`; corregido.

## Decisiones tomadas

- **Costo en USD, no en COP:** la base guarda el costo estimado en dólares (precio del modelo en la plantilla); convertirlo exigiría una tasa que no existe en el sistema.
- **Sin «meta ≥ 50»** junto a las publicadas: no hay una meta registrada en ningún documento ni tabla.
- **Conversión de prueba** definida como cuentas con plan pagado entre todas las que tienen suscripción; no hay un histórico de conversiones para algo más fino.

## Qué quedó abierto

Fase 6: identidad (login, registro, MFA, recuperar), modales, quitar el puente de nombres viejos y `/admin/viz-prueba`, tema por defecto `system`, `ESTADO.md` final.

## Estado al cerrar

- `ESTADO.md` actualizado: no (fase 6)
- `docs/11-avance-por-requerimiento.md` actualizado: sí (RF-108)
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: fase 6
