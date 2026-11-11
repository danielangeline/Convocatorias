# Sesión 040 · 2026-11-10 (Fase 2)

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)
**Commits:** ver `git log` (Sesión 040, Fase 2)

---

## Objetivo de la sesión

Fase 2 del rediseño FundRadar: shell y navegación (`design_handoff_fundradar/README.md`, sección Shell).

## Qué se hizo

Solo presentación y navegación; ningún RF/RN/RNF cambia de estado.

- `menus.ts`: menú de empresa nuevo (Inicio · Convocatorias · Proyectos, Postulaciones, Documentos con IA · Directorio, Mis encargos · Plan y créditos, Ajustes). «Sugeridas» y «Guardadas» salen del menú; sus rutas siguen vivas y cuentan como Convocatorias (`alias`). `tabsDeRol` define las pestañas del móvil.
- `Sidebar.tsx`: 252 px, sin contraer ni grupos colapsables, contadores ámbar, pie con créditos («Te alcanzan para N documentos» con la tarifa real) y fila de usuario.
- `Topbar.tsx`: 60 px con desenfoque, miga, búsqueda de 280 px, tema y campana con ping; en móvil, logo compacto (hamburguesa solo en el panel admin; el consultor lleva «salir» aquí).
- `TabsInferiores.tsx` y `ui/BottomSheet.tsx` (nuevos): Inicio · Buscar · Postular · Proyectos · Más para la empresa; 4 pestañas para el consultor. «Más» abre la hoja con el resto del menú y «Cerrar sesión».
- `AppShell.tsx`: sin modo contraído, `max-w-[1200px]` (consultor 1120, admin 1240), `pb-24` en móvil para no tapar las pestañas; el admin conserva su drawer (overlay y Esc).
- Contadores: Convocatorias = compatibles nuevas de la semana; Postulaciones = listas para radicar (`etapaDe`). El contador de Mis encargos del menú se retira (el handoff no lo incluye).
- `recorrido/pasos.ts`: los 3 pasos de Sugeridas, Beneficios y Guardadas se funden en el de Convocatorias (14 pasos).

## Cómo se verificó

`tsc` limpio, `npm run lint` 0 errores, `npm run build` compila. En el navegador con una empresa temporal (`29b851`, ya borrada): escritorio 1440 px claro y menú, móvil 390 px con pestañas y hoja «Más», `/sugeridas` marca Convocatorias en oscuro. Sin errores de consola salvo el websocket de HMR del modo dev.

## Decisiones tomadas

- `/sugeridas` y `/guardadas` NO redirigen todavía: las pestañas de Convocatorias llegan en la Fase 4 y redirigir antes dejaría ambas pantallas inalcanzables. La redirección se hace con las pestañas.
- «Beneficios tributarios» queda sin entrada propia hasta el chip de la Fase 4 (la ruta `/convocatorias?tipo=beneficio_tributario` sigue funcionando).

## Qué quedó abierto

- Fase 4: pestañas `?tab=`, chips, redirecciones y chip «Beneficio tributario».
- Pendiente revisar el drawer del admin y el portal consultor en móvil con cuentas de esos roles.
- Hasta la Fase 4, desde el menú no se llega a Sugeridas ni Guardadas (sí desde Inicio y la campana).

## Estado al cerrar

Fase 2 lista para revisión; falta la Fase 3 (identidad).
