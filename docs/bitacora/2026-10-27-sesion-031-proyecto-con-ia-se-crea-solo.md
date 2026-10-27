# Sesión 031 · 2026-10-27 · Crear el proyecto con IA: se guarda solo y se edita en su ficha

**Sprint:** 5 · día 13 de 30

## Objetivo de la sesión

A pedido del Product Owner: revisar cómo se ve con el diseño nuevo crear un proyecto con audio o con texto, y que **el proyecto se cree automáticamente** para que la persona vaya editando cada parte. Antes de cambiarlo se le preguntó, porque contradecía RN-37 («nada se guarda sin que la empresa lo confirme en el formulario»); eligió **crear y abrir la ficha**.

## Qué se hizo

- **Documentos primero:** RN-37 (docs/03), CU-43 (docs/01: pasos 6–8 y el alterno 6a), RF-96 y RF-98 (docs/02) y la regla de producto 3 de `CLAUDE.md`.
- **CU-43, RF-98:** `AsistenteProyecto` pide la propuesta (RF-96, el endpoint sigue sin guardar) y enseguida la guarda por `POST /api/proyectos` (las validaciones de `guardar_proyecto` de siempre). Muestra «Armando tu proyecto…» y luego «Guardando…». Si el guardado falla, se abre el formulario lleno con la propuesta para no perderla (6a).
- **Ficha del proyecto:**
  - Aviso «Creamos tu proyecto con IA» (`AvisoCreadoConIA`) con lo que la explicación no dijo y el botón «Ver convocatorias que le sirven» (RF-98). La lista de faltantes viaja en `sessionStorage`, solo para este aviso.
  - **Cada parte editable con su lápiz:** monto, ubicación, categorías y una tarjeta por cada uno de los nueve campos de contenido. Las vacías se ven punteadas en ámbar con «Falta · completar». El lápiz abre el editor situado en ese campo (RF-81).
- `ProyectoFormModal` exporta `desdePropuesta` y `cuerpoDeFormulario`, que usa también el asistente.
- Los modales tienen ahora borde, para que se distingan en modo oscuro.

## Cómo se verificó

Producción local con la **IA real (OpenAI)** y una empresa temporal: explicación escrita de un proyecto de bioinsumos en Pitalito → el proyecto se creó solo, se descontaron 50 créditos (125 → 75) y se abrió la ficha con el aviso (faltantes: duración, presupuesto y experiencia de la empresa), completitud 7/9, monto 400.000.000, Huila · Pitalito y tres categorías. Las tarjetas de duración y presupuesto salen como «Falta · completar». El lápiz abrió el editor con el foco en `campo-duracionMeses`. `tsc`, `eslint` (0 errores) y build limpios.

**No se probó el dictado con micrófono**: el navegador del panel no tiene micrófono. El botón y la transcripción no cambiaron en esta sesión (RF-97, verificados en la sesión 030).

## Después: dictado en vivo (RF-97, mod.)

A pedido del Product Owner («que mientras hablo se vayan escribiendo las palabras»). Se le ofrecieron tres caminos (OpenAI en tiempo real, reconocimiento del navegador, tramos de pocos segundos) y eligió **el reconocimiento del navegador**.

- `BotonDictado`: si el navegador trae `SpeechRecognition` (Chrome, Edge, Safari reciente), dicta en vivo en español de Colombia, con resultados parciales y continuos; se reanuda solo tras un silencio y se detiene a los 5 minutos. Si no lo trae, sigue la grabación con transcripción de OpenAI de antes.
- `AsistenteProyecto`: el cuadro muestra lo ya fijado más lo que aún se está reconociendo (de solo lectura mientras tanto), y avisa que el reconocimiento lo hace el navegador («en Chrome, con el servicio de voz de Google»).
- Documentado en RF-97 (docs/02) y CU-43 paso 2 (docs/01): el dictado en vivo no pasa por esta plataforma ni por OpenAI, no consume crédito ni cuenta en el tope diario.
- **Verificación:** el navegador del panel bloquea el micrófono, así que se probó con un reconocedor simulado inyectado en la página: el texto parcial apareció a los 2 s («Escuchando · 0:02»), las frases fijas se fueron sumando y al detener quedó el texto completo, editable. **Falta la prueba con micrófono real en Chrome o Edge.**

## Después: editor por apartados y «Editar con IA» (RF-109, CU-47, nuevos)

Pedido del Product Owner sobre el editor del proyecto: «hazlo mucho más grande; que las casillas de texto se puedan agrandar; en cada apartado una opción de editar con IA, con audio o texto; un botón en cada apartado para editar esa parte; y las categorías en casillas independientes: tipo de entidad, sector y tipo de proyecto». Antes se le preguntó el costo y cómo se aplica: **10 créditos** y **la IA propone, la persona acepta**.

- **Documentos primero:** CU-47 (docs/01), RF-109 (docs/02), endpoint (docs/04), §9.35 (docs/05), trazabilidad (docs/09), RN-17 y RN-37 (docs/03), docs/00 y las reglas 3 y 5 de `CLAUDE.md` (la IA tiene ahora **tres** usos).
- **Base:** migración `20261027200000` (ensayada con `raise` y aplicada): tarifa `edicion_apartado` = 10, tipo de consumo nuevo, columna `accion` en `reservas_estructuracion`, `reservas_de` por tarifa de cada reserva y `iniciar/completar/fallar_edicion_apartado` (solo `service_role`, RN-30 en la base).
- **Servidor:** `lib/ia/editar-apartado.ts` (instrucción fija con las reglas de veracidad y de no obedecer texto incrustado, esquema `{texto, faltantes}`, saneamiento y limpieza de la respuesta) y `editarApartadoConIA` en `lib/proyectos-ia-servidor.ts`; `POST /api/proyectos/[id]/editar-con-ia` con límite de tasa de la IA. No guarda: la persona acepta y guarda (RN-37). El panel muestra la tarifa nueva en `/admin/planes` y el consumo en `/admin/consumo-ia`.
- **Pantalla:** `ProyectoFormModal` reescrito: hasta 5xl de ancho y 94 % de alto, cabecera y pie fijos, cada apartado en su tarjeta, cajas de texto grandes que se agrandan (`resize-y`), categorías en tres casillas (tipo de proyecto, sector, tipo de entidad) con botones grandes y el conteo de elegidas. El lápiz de la ficha abre **solo ese apartado** (con «Ver todo el proyecto»); nombre y descripción también tienen lápiz. `EditarConIA`: petición escrita o dictada (en vivo), «Proponer cambio · 10 créditos», propuesta con lo que falta, «Usar esta versión» o «Descartar».
- **Solo apartados de texto** tienen IA; monto, duración, presupuesto, ubicación y categorías se editan a mano (la IA no propone cifras, RNF-23).

**Verificación:** `scripts/prueba-editar-apartado.mjs` (nueva) **16/16** con el proveedor de prueba: barreras (visitante, consultor 403, otro origen 403, proyecto ajeno 404, apartado numérico 400, petición corta o larga 400), tarifa 10, fallo 502 sin cobro, éxito con exactamente 10 descontados, el proyecto no cambia hasta guardar y los dos consumos registrados. Regresión: `prueba-proyecto-ia.mjs` en verde; SQL `creditos_por_tarifa.sql` 13/13 (se actualizó a 4 tarifas), `estructuracion_proyecto.sql`, `generacion_ia.sql` y `rnf_esquema.sql` sin fallas. En pantalla: editor de un solo apartado, propuesta de la IA (proveedor de prueba) y formulario completo con las tres casillas de categorías.

## Decisiones tomadas

- **El endpoint de estructurar sigue sin guardar** (RF-96): guarda la pantalla con el mismo endpoint de CU-09. Así no se duplican las validaciones y la base sigue siendo la única que decide la forma.
- **«Experiencia de la empresa» aparece entre los faltantes aunque la IA llenó algo:** la IA lo marca porque la explicación no trae antecedentes; lo que puso es una frase de la propia explicación. Se deja visible para que la empresa lo revise; no se tocó la instrucción de la IA.

## Qué quedó abierto

- Las cuentas temporales del recorrido **siguen vivas** para que el Product Owner revise (sufijo `d9cf7c`). Se borran con `node --env-file=.env.local scripts/cuentas-recorrido.mjs borrar <archivo>` (el archivo está en el directorio temporal de la sesión).
- Sin push: pendiente de la revisión del Product Owner.

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: sí (RF-98)
- `tsc --noEmit` y `lint` limpios: sí
