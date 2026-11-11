# Sesión 040 · 2026-11-10

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)
**Duración aproximada:** —
**Commits:** ver `git log` (Sesión 040)

---

## Objetivo de la sesión

Fase 1 del rediseño FundRadar (`design_handoff_fundradar/`): tokens y marca.

## Qué se hizo

- Presentación únicamente; ningún RF/RN/RNF cambia de estado.
- `app/globals.css`: tokens claro y oscuro nuevos; `--line-strong`, `--amber-soft`, `--rose-soft`, `--topbar`, `--overlay`; se quitan `--violet`, `--sky`, `--side`; `@keyframes ping` y `.ping-ring` con reduced motion.
- `app/layout.tsx`: Source Serif 4 (500, 600), Inter (400 a 700), IBM Plex Mono (500). Título «FundRadar».
- `Logo.tsx` (anillos y punto ámbar), `Button` (radio 4, `min-h-11`, variante `outline`), `Card` (radio 6, sin sombra), `Badge` (tonos `ok|aviso|error|neutro`, alias `pri|amber|rose`), `PageHeader` (H1 serif), `Deadline` y `CompatRing` con las reglas de color del README.
- Migración mecánica de ~60 archivos: `violet`/`sky` → `pri`; `variant="ai"|"consultor"` → `primary`; `outline-amber` → `outline`; «Gestión de Convocatorias» → «FundRadar»; `amber-ink` ahora es la tinta.
- ESLint ignora `design_handoff_fundradar/**`.

## Cómo se verificó

`tsc --noEmit` limpio, `npm run lint` 0 errores, `npm run build` compila. Landing revisada en el navegador en claro y oscuro, sin errores de consola.

## Decisiones tomadas

- Los tonos `violet` y `sky` se fundieron en `pri` en todo el código (un solo acento) en vez de dejar alias; se descartó dejar alias porque mantendría dos colores que el diseño elimina.
- El handoff se copió a la raíz del repo como referencia.

## Qué quedó abierto

- Revisar a 390 px y pantalla por pantalla (el sidebar actual sigue siendo el viejo hasta la Fase 2). Los textos «Convocatorias» del recorrido y del menú son el nombre de la sección, no la marca; se dejan.
- Pantallas que antes distinguían IA/consultor por color ahora son teal: revisar jerarquía en las fases 4 a 6.

## Hallazgos no planificados

- El portal usa muchas clases `rounded-2xl`/`shadow-card` fuera de `Card`; se ajustan en cada fase.

## Estado al cerrar

Fase 1 lista para revisión; falta la Fase 2.
