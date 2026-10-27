# Sesión 031 · 2026-10-27 · Rediseño visual, fase 4 (Consultor)

**Sprint:** 5 · día 13 de 30

## Objetivo de la sesión

Fase 4 del rediseño: pantallas del portal Consultor. Solo presentación (RN-28 intacta: sin cupo de IA propio).

## Qué se hizo

- **Mis encargos (CU-18):** chip «Perfil aprobado · visible en el directorio», cuatro indicadores (solicitudes nuevas, en curso, calificación x/5 y completados; la calificación solo aparece con al menos un encargo completado) y pestañas con el primitivo `Tabs` y su conteo. Las solicitudes con Aceptar/Rechazar y el resto de la lógica no cambian. Los datos del perfil salen de `exigirRol` en la página.
- **Mi perfil (CU-16, CU-17):** anillo de completitud de 84 px y lista de pasos (foto, descripción, especialidad, hoja de vida), calculados con la misma lista `faltan` que ya orientaba el envío a revisión; la base sigue decidiendo.
- **Documentos y suscripción:** tarjetas sobre `bg-surface` con sombra; la barrida de la fase 3 ya había migrado sus colores. Barrida adicional: tarjetas `rounded-2xl border` sin fondo en todas las pantallas.

## Cómo se verificó

Consultora temporal (`scripts/cuentas-recorrido.mjs`, ya borrada) contra un servidor de producción local (`npm run build` + `prod`): `/consultor/encargos` en claro y `/consultor/perfil` en oscuro (anillo al 25 % con los pasos tachados o pendientes). `tsc`, `eslint` (0 errores) y build limpios.

## Decisiones tomadas

- **Encargos en curso como tarjetas, no tabla:** cada uno lleva su nota de avance, el botón de completar y el contexto; una tabla no los puede alojar. Los indicadores y las pestañas dan el resumen.
- **Sin dashboard de «Inicio» del consultor:** su pantalla de entrada sigue siendo Mi perfil (`rutaInicioDeRol`); los indicadores viven en Encargos para no crear una ruta nueva sin caso de uso.
- **Sin «Buscar convocatorias» en el menú:** la búsqueda del encargo (RF-91) cuelga de cada encargo en curso, no es una pantalla propia.

## Hallazgos no planificados

- `npm run build` pisa `.next` de un servidor de desarrollo que otro chat tenía en el puerto 3000 sobre esta misma carpeta: ese servidor devolvió 404 hasta reiniciarse. Se verificó con `prod` en el 3100.
- Siguen sin commitear y sin ser de esta sesión: `lib/acciones/auth.ts`, `lib/autorizacion/eventos.ts`, `lib/limite-tasa.ts`, `docs/03` y `docs/05`.

## Estado al cerrar

- `ESTADO.md` actualizado: no (fase 6)
- `docs/11-avance-por-requerimiento.md` actualizado: no aplica
- `tsc --noEmit` y `lint` limpios: sí
- Siguiente paso: fase 5, Admin
