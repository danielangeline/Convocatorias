# Sesión 040 · 2026-11-10 (Fase 4)

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)

## Objetivo de la sesión

Fase 4 del rediseño FundRadar: portal empresa, las 11 pantallas del README del handoff.

## Qué se hizo

Presentación, navegación y jerarquía; ninguna regla de negocio, consulta, migración ni autorización cambia (CU-07..13, CU-20..22, CU-28, CU-44..46; RF-11, RF-12, RF-18, RF-103, RF-104, RF-106 sin cambios de lógica).

- **Inicio** (CU-44, RF-101): tarjeta «Tu próximo paso» con una sola acción (`lib/proximo-paso.ts`: postulación en preparación con el cierre más cercano y pendientes → registrar el primer proyecto → revisar sugeridas), franja de 4 KPI en una tarjeta con celdas clicables y dos listas. La gráfica de fondos por mes y el bloque de sugeridas salieron de Inicio.
- **Convocatorias** (CU-07, RF-12): pestañas `?tab=todas|sugeridas|guardadas`, chips rápidos, filas nuevas (`FilaConvocatoria`), línea de resultados con ping de «nuevas esta semana», panel de filtros (lateral de 420 px en escritorio y hoja inferior de 86 % en móvil) con botones de opción de 38 px, «Cuánto necesitas» y el pie «Ver N convocatorias» con recuento en vivo. `/sugeridas` y `/guardadas` ahora redirigen a la pestaña.
- **Ficha** (CU-08): rejilla de 4 datos, «¿Te aplica?» con el cruce real criterio por criterio (`CompatBreakdown`), requisitos numerados, columna de acción pegajosa («Me interesa», guardar, borrador con IA con créditos reales, consultor) y barra fija en móvil.
- **Proyectos** (CU-09): tarjetas con barra de información (ámbar bajo 70 %), consejo del primer campo que falta, cifras reales de compatibles (mismo cruce de CU-10, `compatiblesPorProyecto`) y postulaciones; «Nuevo proyecto» abre el modal de 2 caminos (IA con la tarifa real, o formulario).
- **Postulaciones** (CU-13, RF-104): tablero de 4+ columnas o lista en escritorio; chips de etapa y tarjetas en móvil. La etapa «Documentos» pasa a «Reuniendo documentos».
- **Detalle** (CU-12): stepper de 4 etapas calculado con `etapaDe()` sobre el avance vivo, checklist interactivo de 52 px, «Siguiente paso», historial con fecha mono y «Marcar como radicada» cuando está completa.
- **Documentos, Directorio, Encargos** (barra de 4 tramos), **Plan y créditos** (créditos traducidos a documentos con la tarifa real) y **Ajustes**.
- Pasada mecánica sobre `app/` y `components/`: radios (4/6 px), sin sombras en tarjetas, overlays con `--overlay`, pesos y tonos del handoff.

## Cómo se verificó

`tsc` limpio, `npm run lint` 0 errores, `npm run build` compila. En el navegador con una empresa temporal (`168c84`, ya borrada) y el catálogo real: Inicio con «próximo paso» tras crear una postulación, Convocatorias y su panel de filtros (420 px), Ficha con barra móvil, Postulaciones y Plan y créditos a 390 px, y recorrido por Proyectos, Documentos, Directorio, Encargos, Ajustes y la redirección de `/guardadas`; sin errores de consola salvo el websocket de HMR del modo dev.

## Decisiones tomadas

- **Chips «No reembolsable» y «Crédito» omitidos:** no existe ese dato en las convocatorias; filtrar por él exigiría un campo nuevo (documentar primero, regla 5 de `CLAUDE.md`). Quedan «Para mi perfil», «Cierran en 15 días», «Beneficio tributario» y «Cooperación».
- **«Para mi perfil»** usa compatibilidad ≥ 60 % (CU-10) y arranca activo solo si hay proyectos y no se llegó con una búsqueda o un tipo; el aviso del panel no inventa el perfil («empresa del sector agro en Huila»).
- **Sin «Recomendado» en los planes, sin cajas de paquetes de créditos, sin «Adjuntar» por requisito, sin tarjeta de consultor en el detalle, sin «verificada hoy», sin hora del último rastreo:** ninguno tiene dato ni función detrás; no se inventan.
- **Directorio:** un solo botón «Ver perfil y solicitar» (la solicitud vive en el perfil); las tarjetas no muestran ciudad ni bio porque `ConsultorDirectorio` no las trae.
- Se quitó el contador de «Mis encargos» del menú (fase 2) y la gráfica de Inicio, como pide el handoff.

## Qué quedó abierto

- Decidir si se agregan a la ficha de convocatoria los campos «modalidad» (no reembolsable / crédito) y a la fuente la hora de su último rastreo.
- Pantallas secundarias sin rediseño propio (solo la pasada mecánica): ficha del proyecto, sugerencias del proyecto, editor de documento, generar, perfil del consultor, modales de solicitud y formularios de proyecto. Revisarlas a 390 px.
- Falta recorrido en navegador con cuentas con proyectos y encargos para ver los estados llenos de esas pantallas.
- Ficha: la barra móvil usa un icono de guardar de 16 px; subirlo a 20 px.

## Estado al cerrar

Fase 4 lista para revisión; falta la Fase 5 (portal consultor).
