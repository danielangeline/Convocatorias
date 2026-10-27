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
