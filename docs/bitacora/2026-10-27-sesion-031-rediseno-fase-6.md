# Sesión 031 · 2026-10-27 · Rediseño visual, fase 6 (identidad, modales y barrida final)

**Sprint:** 5 · día 13 de 30

## Objetivo de la sesión

Cerrar el rediseño: pantallas de identidad, modales, quitar lo provisional y dejar el tema oscuro como ciudadano de primera.

## Qué se hizo

Solo presentación; no cambia ningún requerimiento.

- **Identidad** (login, registro, MFA, recuperar, definir contraseña): tarjeta centrada sobre `--bg` con la marca nueva (`components/shell/Logo.tsx`) y el cambio de tema. La barrida de clases llegó también a `components/identidad` y `app/(identidad)`.
- **Portada pública:** marca nueva, cambio de tema, la franja final sobre `pri-soft` en vez del azul fijo (que en oscuro quedaba ilegible).
- **Modales:** todos sobre `bg-surface` con el fondo oscuro `bg-black/50` (la barrida de la fase 3 lo había perdido en 17; se corrigió en la sesión del portal Empresa y se revisó otra vez aquí).
- **Barrida final:** se retiró de `app/globals.css` el puente de nombres viejos (`primary-*`, `gold-*`, `brick-*`, `teal-*`, `ink-soft`, `success`…), y de `Button` y `ProgressBar` los alias (`teal`, `brick`, `outline-gold`, tonos viejos). Los últimos usos pasaron a `ai`, `consultor`, `outline-amber`, `violet`, `rose`, `amber`, `pri`. Búsqueda final: **0** clases con nombres viejos, **0** colores por defecto de Tailwind y **0** hex en `app/` y `components/` (quedan `text-white` sobre botones de color y los velos `bg-black/40-50`).
- **Tema por defecto: el del sistema** (`next-themes`, sin parpadeo).
- Se borraron `/admin/viz-prueba` y `components/viz/VizMuestra.tsx`.

## Cómo se verificó

Producción local: `/login` en claro siguiendo el sistema; `/registro?puerta=consultor` en oscuro a 390 px (sin desborde horizontal: `scrollWidth` 390); portada en oscuro a 1280 px. Regresión: `prueba-matriz-roles.mjs` TODO PASÓ, `prueba-guardadas.mjs` TODO EN VERDE, `prueba-catalogo-empresa.mjs` TODO PASÓ, `prueba-rnf-criticos.mjs` TODO PASA. `tsc`, `eslint` (0 errores; los 10 avisos de `scripts/` ya existían) y build limpios.

## Decisiones tomadas

- **`text-white` se queda** sobre los botones sólidos de celeste y rosa (consultor, peligro): en los dos temas el fondo es saturado y el blanco cumple el contraste.
- **El menú de usuario de `/mfa`** conserva su componente (`MenuUsuario`), ahora con tonos `amber/sky/pri`.

## Qué quedó abierto

- Guardar tipo y origen desde el editor del panel en pantalla (la lectura sí se comprobó, y la base lo cubre).
- Fusionar `sprint-2` a `main` cuando el Product Owner lo pida.

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: no aplica en esta fase
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: revisión del Product Owner y fusión a `main`
