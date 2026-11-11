# Sesión 040 · 2026-11-10 (Fase 5)

**Sprint:** 5 · día 12 de 30 (rediseño visual, sin RF nuevos)

## Objetivo de la sesión

Fase 5 del rediseño FundRadar: portal consultor (`app/consultor/*`).

## Qué se hizo

Presentación y jerarquía; la lógica de perfil, revisión, encargos y documentos no cambia (CU-16..18, CU-28; RF-22..25, RF-30, RF-32, RF-70, RN-25, RN-28).

- **Mi perfil** (`EditorPerfil`): banda `pri-soft` con el anillo de 76 px y «Te faltan N cosas para el 100 %» con la lista concreta, «Publicado en el directorio» cuando está aprobado, dos columnas (datos principales, especialidades como botones conmutables de 38 px, redes, portafolio con borde discontinuo y badge «Pendiente» si está vacío; lateral con zona de arrastre para la hoja de vida y la reputación). «Guardar cambios» arriba en escritorio y barra fija sobre las pestañas en móvil.
- **Encargos** (`EncargosConsultor`): franja de 4 KPI y pestañas; la solicitud nueva es una tarjeta con borde izquierdo ámbar de 3 px, empresa y antigüedad, convocatoria en serif, proyecto y cierre, y el mensaje de la empresa entre comillas.
- **Documentos**: filas con estado, versión y fecha en mono, proyecto en serif, pendientes y «Abrir».
- **Mi suscripción**: reutiliza la vista de la Fase 4 (sin cupo de IA, RN-28).

## Cómo se verificó

`tsc` limpio, `npm run lint` 0 errores, `npm run build` compila. En el navegador con una consultora aprobada temporal (`2ce3ce`, ya borrada): perfil a 1440 y 390 px, encargos, documentos y suscripción sin errores de consola ni desborde horizontal.

## Decisiones tomadas

- **«Aceptar encargo» y «No puedo»** en lugar de «Enviar propuesta»: en este producto el consultor acepta o rechaza el encargo (CU-18); «propuesta» es otra cosa (CU de búsqueda, RF-92). No se cambió el flujo.
- **Sin «Ver como empresa»**: `/consultores/[id]` es del portal empresa y el consultor no tiene acceso (RNF-30); habría que crear una vista previa y documentarla antes.
- **En curso sin «lista de tareas acordadas»**: no existe ese dato; se conserva la lista de avances.
- **Documentos: «Puede editar»** como único permiso, porque así lo describe la pantalla (leer, editar y pedir ajustes); el modelo no tiene permiso «comentar».

## Qué quedó abierto

- Probar con datos: un encargo pendiente, uno en curso y uno en historial, y un documento compartido, para ver los estados llenos (las cuentas temporales no los traen).
- El pie del portal dice «la cuenta es real, el resto, datos de ejemplo»: ya no es cierto (hallazgo, no se tocó).
- Pantallas secundarias del consultor sin rediseño propio: documento compartido, búsqueda y propuestas del encargo.

## Estado al cerrar

Fase 5 lista para revisión; falta la Fase 6 (panel admin).
