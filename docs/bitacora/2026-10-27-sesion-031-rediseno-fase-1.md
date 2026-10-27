# Sesión 031 · 2026-10-27 · Rediseño visual, fase 1 (base)

**Sprint:** 5 · día 13 de 30
**Commits:** sin commit al escribir esta entrada

---

## Objetivo de la sesión

Aplicar el rediseño visual (solo presentación, sin tocar negocio, servidor, migraciones ni RLS). Esta sesión cubre la **fase 1** del plan de seis: tokens, tipografía, tema, `components/ui` y `components/viz`.

## Qué se hizo

Cambio de presentación: no cambia ningún `RF-xx`/`RNF-xx`.

- Referencia copiada a `docs/diseno/convocatorias-app.html` (venía del escritorio, formato `.dc.html`).
- **Tokens** semánticos claro/oscuro en `app/globals.css` (`--bg`, `--surface`, `--pri`, `--amber`, `--violet`, `--sky`, `--rose`…), expuestos con `@theme inline` como utilidades (`bg-surface`, `text-ink-2`, `border-line`…) y `@custom-variant dark`.
- **Puente temporal:** los nombres viejos (`primary-*`, `gold-*`, `brick-*`, `teal-*`, `ink-soft`…) apuntan a los tokens nuevos para que las pantallas sin migrar sigan funcionando. Se eliminan en la fase 6.
- **Tipografía:** Plus Jakarta Sans (400–800) + IBM Plex Mono; se retiran Inter y Manrope.
- **Tema:** `next-themes` (`ThemeProvider`, `ThemeToggle`), clase `dark`, sin parpadeo. Por defecto **claro** mientras las pantallas migran; pasa a `system` en la fase 6.
- `components/ui`: Button (añade `ai` y `consultor`; `teal` y `brick` quedan como alias), Badge (`tono`), Chip, EmptyState, ProgressBar, SearchableSelect reescritos; nuevos Card, CardHeader, PageHeader, Segmented, Tabs, Drawer, DataTable. Los props existentes se conservan.
- `lib/utils.ts`: los `ESTADO_*_ESTILO` usan los tokens (publicada/activa → pri; borrador/cerrada → neutro; en gracia → amber; trial → sky; vencida → rose).
- `components/viz`: KpiCard/KpiGrid, StackedBarChart, WeeklyBars, SegmentedBar, CompatRing, CompatBreakdown, DeadlineTile/Chip, ProgressRow, KanbanBoard, MiniStatGrid, ChecklistSteps, CreditMeter. HTML/CSS, sin librerías; animación de 400 ms desactivada con `prefers-reduced-motion`; `role="img"` + `aria-label` y tabla `sr-only`; escalan contra el máximo de la serie; sin datos muestran estado vacío.

## Cómo se verificó

- `tsc --noEmit` y `eslint` sin errores (ver estado al cerrar para el build).
- Muestra de todas las piezas con datos de ejemplo en `/admin/viz-prueba` (`components/viz/VizMuestra.tsx`). Se vio en el navegador en claro y en oscuro; los anchos de `SegmentedBar` medidos por JS coinciden con las proporciones (161/74/20/13/7 px para 24/11/3/2/1).
- Para verla sin cuenta de administrador se abrió una ruta pública temporal y una línea temporal en `lib/autorizacion/matriz.ts`; **ambas se revirtieron** (`git diff` de la matriz vacío).

## Decisiones tomadas

- **`/admin/viz-prueba` en vez de `/admin/_viz`:** en el App Router una carpeta con guion bajo es privada y no se enruta. Se borra en la fase 6, junto con `VizMuestra.tsx`.
- **Puente de nombres viejos** en lugar de migrar ~700 clases de golpe: descartado migrar todo en la fase 1 porque dejaba la app rota entre fases.
- **Tema por defecto claro** hasta la fase 6: con `system` un usuario con el sistema en oscuro vería pantallas a medio migrar.
- **Plus Jakarta Sans también como `font-display`:** el rediseño usa una sola familia para títulos y cuerpo.

## Qué quedó abierto

Fases 2 a 6 del plan (shell, Empresa, Consultor, Admin, identidad y barrida final).

## Hallazgos no planificados

- `docs/diseno/convocatorias-app.html` depende de `support.js` (runtime `<x-dc>`) que no está en el escritorio junto al archivo: sirve para leerlo, no para abrirlo en el navegador.

## Estado al cerrar

- `ESTADO.md` actualizado: no (el rediseño se refleja al cerrar la fase 6)
- `docs/11-avance-por-requerimiento.md` actualizado: no aplica (sin cambio de requerimientos)
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: fase 2, el shell (`AppShell`, `Sidebar`, `Topbar`) en los tres layouts
