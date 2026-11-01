# Sesión 038 · 2026-11-01

**Sprint:** 5 · día 15 de 30
**Duración aproximada:** una sesión corta
**Commits:** ver `git log` («Sesión 038: …»)

---

## Objetivo de la sesión

Pedido del Product Owner: un tutorial para que cualquier empresa que inicia sesión por primera vez entienda cómo funciona la aplicación, con un recuadro pequeño al lado de cada sección que explique qué se hace ahí, y la opción de saltar pasos u omitirlo por completo.

## Qué se hizo

- **CU-51 y RF-119 (nuevos)**, especificados primero (docs/01, 02, 04, 05, 09).
- **Recorrido** (`components/recorrido/RecorridoBienvenida.tsx`, textos en `pasos.ts`): 17 pasos —bienvenida, Inicio, buscador, Convocatorias, Sugeridas, Beneficios tributarios, Guardadas, Proyectos, Postulaciones, Documentos con IA, Directorio, Mis encargos, Plan y créditos, medidor de créditos, notificaciones, Ajustes y cierre con «Ir a Proyectos»—. Resalta el elemento (`data-recorrido` en el menú, la barra superior y el pie de créditos) y ubica el recuadro a su derecha, debajo o encima, siempre dentro de la ventana; si el elemento no está a la vista (móvil, grupo plegado), va centrado. «Paso N de M», barra de avance, Anterior, Siguiente, «Omitir tutorial»; Esc omite y las flechas avanzan o retroceden.
- **Base:** `perfiles.recorrido_visto_at` y `marcar_recorrido_visto()` (security definer, solo `auth.uid()`, solo la primera vez); el trigger de `perfiles` impide cambiarla directamente. Migración `20261101100000`, simulacro con `db push --dry-run` y aplicada.
- **Endpoint** `POST /api/cuenta/recorrido` (solo empresa, mismo origen, por `conEmpresa`). El layout del portal lee la columna en la misma consulta del consentimiento.
- **Ajustes:** tarjeta «Ayuda» con «Ver el recorrido».
- Los textos no prometen radicar (RN-19) ni fijan tarifas de créditos (RF-100).

## Cómo se verificó

- `tsc --noEmit` y `eslint` limpios.
- Recorrido con Playwright en un navegador aparte, con dos empresas temporales (`b135a8`, creadas y borradas con `scripts/cuentas-recorrido.mjs`): al primer ingreso se abre solo; los 17 pasos en orden con su elemento resaltado; Esc lo cierra y la base guarda la fecha (la otra empresa seguía en null); al recargar no vuelve; Ajustes lo reabre desde el paso 1; «Ir a Proyectos» lleva a `/proyectos`; a 375 px el recuadro queda centrado sin desborde (27–347 px de 375). Sin errores en la consola. Capturas en `docs/evidencias/sesion-038/` (la 01 es de la primera versión, con la X en lugar de «Omitir tutorial» arriba).
- **Ajuste durante la prueba:** con tres botones abajo el recuadro partía la fila en dos; «Omitir tutorial» pasó a la cabecera.

## Decisiones tomadas

- **En la cuenta y no en el navegador.** «Primera vez» es por cuenta: con `localStorage` volvería a aparecer en cada equipo o navegador nuevo. Se descartó por eso.
- **Omitir cuenta como visto.** Quien lo omite no quiere verlo en cada ingreso; queda en Ajustes.
- **Sin librería de recorridos** (driver.js, react-joyride): unas 200 líneas propias, con los tokens del diseño y sin dependencia nueva.

## Hallazgos no planificados

- Las empresas existentes tienen la columna vacía, así que también verán el recorrido en su próximo ingreso. Si no se quiere, basta un `update perfiles set recorrido_visto_at = now() where rol = 'empresa'` (no se hizo: decide el Product Owner).
- `.playwright-mcp/` sigue sin estar en `.gitignore`.

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: sí
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: que el Product Owner lo revise en pantalla; fusionar a `main` cuando lo pida.
