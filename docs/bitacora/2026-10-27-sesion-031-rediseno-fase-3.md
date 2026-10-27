# Sesión 031 · 2026-10-27 · Rediseño visual, fase 3 (Empresa)

**Sprint:** 5 · día 13 de 30

---

## Objetivo de la sesión

Fase 3 del rediseño: las pantallas del portal Empresa. Solo presentación, salvo la pantalla nueva `/inicio`, que se documentó primero.

## Qué se hizo

- **CU-44 y RF-101 (nuevos, `verificado`)** — `/inicio`: saludo con fecha, resumen de una línea, cuatro indicadores (compatibles, postulaciones activas, monto en juego, créditos de IA), fondos por mes de cierre, próximos cierres, sugeridas con anillo de compatibilidad y avance de postulaciones. Todo de datos reales: `listarProyectos`, `sugerenciasDeProyecto` (CU-10, hasta 8 proyectos, mejor porcentaje por convocatoria), `listarPostulaciones` y el saldo del store. Con la suscripción vencida (402) la parte de sugerencias se omite; un bloque sin datos no se dibuja.
  - Documentado antes en docs/01, 02, 04, 09 y 11. La ruta se registró en `lib/autorizacion/matriz.ts` (rol empresa) y `rutaInicioDeRol(empresa)` ahora es `/inicio` (el menú lleva «Inicio»).
- **Barrida mecánica de clases** (todas las pantallas, no solo Empresa): los nombres viejos (`ink-soft`, `primary-*`, `teal-*`, `brick-*`, `gold-*`, `slate-*`, `emerald-*`, `danger`…) pasan a los tokens nuevos; `bg-white`→`bg-surface`; textos tonales con `text-{violet,sky,amber,rose}-ink` (mezcla con la tinta, legible en claro y oscuro); campos con `bg-surface text-ink`; títulos de página 26/800. 53 archivos, sin lógica tocada. Cubre de paso lo mecánico de las fases 4 y 5.
- **Catálogo (RF-11, RF-12, RF-94, RF-95):** `PageHeader`, selector tarjetas/lista (`Segmented` + `DataTable`), tarjeta nueva (badge de estado, nombre 15/800, entidad, 2 líneas, monto en mono, `DeadlineChip` bajo 15 días, atenuada si está cerrada y sin acciones, RN-02). Los 20 filtros, el orden, los chips activos y los conteos no cambian. `?q=` rellena el cuadro de búsqueda (la barra superior ya lo usa).
- **Postulaciones (CU-13):** tablero por estado (`KanbanBoard`, los seis estados reales) y vista de lista.
- `StackedBarChart` admite `unaSerie` (ver decisiones). `Button` acepta `outline-amber`.

## Cómo se verificó

Empresa temporal (`scripts/cuentas-recorrido.mjs`, ya borrada; 0 cuentas sobrantes) con un proyecto y dos postulaciones creados por la API de la propia sesión. Vistas en el navegador del panel: `/inicio` en claro y en oscuro (11 compatibles, 2 postulaciones activas, 14 mM, 125/125 créditos, barra de noviembre, cierres 4/7/8/8 días), `/postulaciones` (tablero), `/convocatorias?q=solar` (la búsqueda llega al cuadro), `/proyectos`, `/consultores`, `/suscripcion` y `/encargos` en oscuro. `tsc`, `eslint` (0 errores) y `npm run build` limpios.

## Decisiones tomadas

- **Gráfica de fondos con una sola serie, sin público/privado:** el modelo de datos no tiene el origen de la convocatoria (ni público/privado ni tipo de fuente). Inventarlo rompería RNF-23, y el prompt pide no mostrar visualizaciones sin dato real. El segmentado «Fondos / Beneficios tributarios» y los chips de origen quedan fuera por lo mismo.
- **Ficha de convocatoria sin Drawer ni desglose de compatibilidad:** la ficha conserva su página (ya restilizada por la barrida). El desglose por criterio necesita un proyecto elegido; cabe mejor en las sugerencias de un proyecto, que ya lo muestran.
- **Barrida con script en vez de reescribir 6 000 líneas a mano:** el resultado es consistente y deja el diff revisable; las pantallas que lo pidan se afinan en las fases 4 y 5.
- **Sin consultor asignado en el tablero:** `Postulacion` no tiene ese dato.

## Qué quedó abierto

Fases 4 (Consultor), 5 (Admin) y 6 (identidad, modales, borrar el puente de nombres viejos y `VizMuestra`, `ESTADO.md`). Backlog de menú: Guardadas, Reseñas, Consumo de IA, Beneficios tributarios, notificaciones, origen público/privado de la convocatoria (necesita modelo de datos).

## Hallazgos no planificados

- Otro chat tenía su servidor de desarrollo en el puerto 3000 sobre esta misma carpeta; se verificó contra ese (comparte el código) sin tocarlo.
- Siguen sin commitear, y sin ser de esta sesión, `lib/acciones/auth.ts`, `lib/autorizacion/eventos.ts`, `lib/limite-tasa.ts`, `docs/03` y `docs/05`.

## Estado al cerrar

- `ESTADO.md` actualizado: no (se actualiza al cerrar la fase 6)
- `docs/11-avance-por-requerimiento.md` actualizado: sí (RF-101)
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: fase 4, Consultor (inicio con KPIs y anillo de completitud, encargos con solicitudes y tabla)
