# Sesión 039 · 2026-11-04

**Sprint:** 5 · día 18 de 30
**Duración aproximada:** una sesión corta
**Commits:** ver `git log` («Sesión 039: …»)

---

## Objetivo de la sesión

Pedido del Product Owner: «un Excel con el formato para subir en masa las convocatorias» y un prompt para que el agente de IA que las busca llene cada casilla como exige el formato, «para que no se suba sin el término de referencia o sin lo que sea necesario».

## Qué se hizo

- **CU-50, RF-118 (material de apoyo, sin código)**: `docs/plantillas/plantilla-carga-masiva-convocatorias.xlsx` con cuatro hojas:
  - **Convocatorias**: la fila 1 son los 20 encabezados exactos de `COLUMNAS_CARGA`, en el mismo orden; colores por obligatoriedad (rojo = la plataforma la exige; verde = regla del agente; azul = opcional), comentario con la regla en cada encabezado, listas desplegables para `tipo`, `origen` y `cobertura_nacional`, celdas en formato texto (fechas y códigos DANE como `05` no se alteran).
  - **Prompt para el agente**: instrucciones de búsqueda (solo fuentes oficiales, no inventar, montos en la moneda original — RNF-23, RN-40) y las condiciones para incluir una fila: cierre futuro, **al menos un enlace directo =TDR**, países y enlace oficial. Lo que no cumple va a un informe de descartadas.
  - **Guía de columnas** y **Listas válidas**: fuentes y categorías activas leídas de la base el 4-nov, departamentos DANE, países ISO y tipos de documento.
- Explicación al Product Owner de cómo subir el archivo (guardar como CSV UTF-8 → Panel → Convocatorias → «Carga masiva»).

## Cómo se verificó

Los encabezados de la hoja `Convocatorias` se compararon con las claves de `lib/admin/carga-masiva.ts`: iguales y en el mismo orden (20). Las listas válidas salen de la consulta a `fuentes`, `categorias`, `departamentos` y `paises` del proyecto real.

## Decisiones tomadas

- **El prompt va en su propia hoja, no encima de la tabla**: el importador lee la fila 1 como encabezados; texto encima rechazaría el archivo entero.
- **La exigencia de TDR, países y enlace es del agente, no del importador**: la plataforma sigue aceptando filas sin documentos (RF-118 no cambia). Si se quiere que el servidor la exija, es un cambio de RF-118 a especificar.
- La hoja no trae fila de ejemplo: el importador la rechaza por nombre; los ejemplos están en los comentarios y en la guía.

## Hallazgos no planificados

- Las listas válidas del Excel son una foto del 4-nov: si se crean fuentes o categorías, hay que regenerarlo o el agente se apoyará en una lista vieja. Una descarga del Excel desde el panel, generada al momento, lo resolvería (sin especificar).

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: no aplica (ningún requerimiento cambió de estado)
- `tsc --noEmit` y `lint` limpios: no aplica (sin cambios de código)
- Siguiente paso: el que dejó la sesión 038 en `ESTADO.md`.
