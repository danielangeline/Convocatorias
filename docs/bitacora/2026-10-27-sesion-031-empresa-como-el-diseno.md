# Sesión 031 · 2026-10-27 · Portal Empresa igual al diseño: tipo y origen, guardadas, sugeridas, ajustes y notificaciones

**Sprint:** 5 · día 13 de 30

---

## Objetivo de la sesión

A pedido del Product Owner, con cuatro capturas del diseño: «que la parte de empresa se vea exactamente así; agrega los paneles nuevos, el inicio, las estadísticas, las recomendadas; ajusta las funcionalidades para que funcione». Decisiones que tomó el Product Owner antes de empezar:

- **Tipo y origen de la convocatoria: columnas nuevas**, aplicadas a Supabase, con las 11 publicadas clasificadas según su fuente.
- **Tablero de postulaciones: etapas derivadas del checklist**, sin cambiar los estados de RF-83.
- **Construir Guardadas, Ajustes y Notificaciones.**

## Qué se hizo

- **RF-102 (tipo y origen):** migración `20261027100000` (ensayada con un `raise` final y aplicada con `db push`). Dos columnas con lista cerrada y valor por defecto (fondo, público); `guardar_convocatoria` las recibe y conserva si no llegan; el editor del panel tiene los dos selectores. Clasificación de las publicadas por entidad convocante (docs/05 §9.33). El catálogo filtra por tipo (segmentado «Todas / Fondos y financiación / Beneficios tributarios», sincronizado con `?tipo=` para el menú) y por origen (chips), y el inicio apila los fondos públicos y los privados.
- **RF-103, CU-45 (guardadas):** tabla 36 `convocatorias_guardadas` con RLS (el dueño lee y borra; insertar exige rol empresa y que la convocatoria sea visible). `GET/POST /api/guardadas` y `DELETE /api/guardadas/[id]`; marcador en la tarjeta y en la ficha; pantalla `/guardadas`.
- **RF-104 (tablero por etapa):** `lib/etapas-postulacion.ts`: En preparación (menos de la mitad del checklist), Documentos (la mitad o más), Lista para radicar (todo), Radicada (presentada o en evaluación, con «Radicada hace N d» desde el historial) y Resuelta o cerrada (solo si hay). Cada tarjeta muestra el consultor del encargo vivo ligado a la postulación.
- **RF-105 (notificaciones):** campana en la barra superior con avisos calculados en el layout: postulaciones en preparación y guardadas que cierran en 7 días o menos, encargos completados por calificar y propuestas por revisar. Cuáles ya vio se recuerda en el navegador.
- **RF-106 (sugeridas para ti):** `lib/compatibilidad-empresa.ts` reúne, con `cache`, el mejor porcentaje de cada convocatoria entre los proyectos (hasta 8, `sugerencias_proyecto`, RN-05). Pantalla `/sugeridas` con el desglose por criterio, contador del menú (compatibles publicadas en los últimos 7 días), anillo en cada tarjeta del catálogo y orden por compatibilidad cuando no hay otro elegido.
- **RF-107, CU-46 (ajustes):** `/ajustes` con los datos de la cuenta (solo lectura), cambio de contraseña por la recuperación, cierre de sesión, tema (claro, oscuro, sistema) y restablecer el menú.
- **Inicio (RF-101) como el diseño:** «Compatibles contigo» con «+N nuevas esta semana», «Postulaciones activas» con «N listas para radicar», «Monto en juego» en millones con «COP en N postulaciones», gráfica apilada en miles de millones, cierres con «entidad · monto», sugeridas con su etiqueta de tipo y postulaciones con la etapa.
- **Menú de Empresa:** Inicio · Convocatorias, Sugeridas para ti, Beneficios tributarios, Guardadas · Proyectos, Postulaciones, Documentos con IA · Directorio, Mis encargos · Plan y créditos, Ajustes. Se quita el pie de página del portal (el diseño no lo tiene).
- **Corrección de la fase 3:** la barrida de clases había dejado `bg-black/` sin opacidad en 17 modales y paneles (el fondo oscuro detrás de los modales no se pintaba). Corregido a `bg-black/50`.
- **RNF-35, corregido:** con el shell nuevo, el menú del panel viajaba en el JS de todas las pantallas. Ahora vive en `components/shell/menus-admin.ts`, que solo importa `AdminShell` en `/admin`.

## Cómo se verificó

- SQL: `rls_aislamiento.sql` «TODAS LAS COMPROBACIONES PASARON» (36 tablas); `rnf_esquema.sql` 14/14 OK; `guardar_publicada_completa.sql` 8/8 OK.
- HTTP: `scripts/prueba-guardadas.mjs` nuevo, **25/25** (barreras de rol y origen, aislamiento entre empresas por API y por RLS directa, el consultor no guarda, las cuatro pantallas nuevas 200 para empresa y 403 para consultor, tipo y origen en `/api/convocatorias`). Regresión contra producción local (`next start`): `prueba-matriz-roles.mjs` **TODO PASÓ** (incluye RNF-35 sobre todos los JS), `prueba-catalogo-empresa.mjs`, `prueba-postulaciones.mjs`, `prueba-catalogo-admin.mjs`, `prueba-filtros-catalogo.mjs` y `prueba-sugerencias.mjs` en verde. `prueba-catalogo-empresa.mjs` se ajustó: el nombre de la tarjeta ahora va dentro de su enlace.
- En pantalla, con una empresa temporal (ya borrada) con un proyecto, cuatro postulaciones en las cuatro etapas y dos guardadas: inicio, catálogo, tablero, sugeridas, guardadas, campana (2 avisos) y ajustes en oscuro.
- `tsc`, `eslint` (0 errores) y `npm run build` limpios.

## Decisiones tomadas

- **Tipo y origen fuera de los 20 filtros de `lib/catalogo-filtros.ts`:** recortan el conjunto antes; así `GET /api/convocatorias` no cambia su contrato (sigue devolviendo 400 a parámetros desconocidos). Se descartó añadirlos a la API porque nadie la llama con ellos.
- **«Documentos» en el 50 % del checklist:** el diseño no fija el umbral; se tomó el punto medio. Ajustable en `UMBRAL_DOCUMENTOS`.
- **Las notificaciones no se guardan:** se descartó una tabla porque todos los avisos se derivan de datos que ya existen; el estado «visto» es solo del navegador.
- **El selector de rol de la maqueta (Empresa / Consultor / Admin) no se incluye:** es de la demostración, y el rol lo fija la cuenta (RN-06, RF-85).
- **El tema por defecto sigue en claro** hasta migrar identidad y panel (fase 6); la empresa puede elegir oscuro o sistema en Ajustes.

## Hallazgos no planificados

- `npm run build` pisa el `.next` del servidor de desarrollo de otro chat que comparte la carpeta (sesión 031, fase 4). En `.claude/launch.json`, `dev` pasó a `autoPort: true` para poder levantar uno propio.

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: sí (RF-102..107 en `servidor`)
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: fase 5 (Admin) y fase 6 (identidad, modales y barrida final)
