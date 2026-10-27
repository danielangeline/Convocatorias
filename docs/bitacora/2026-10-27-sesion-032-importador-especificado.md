# Sesión 032 (segunda parte) · 2026-10-27

**Sprint:** 5 · día 12 de 30

## Objetivo de la sesión

Decisión del Product Owner: «cambia la regla 4 para importar a borrador, agrega país de elegibilidad y moneda, y especifica el importador de Grants.gov, UE e iNNpulsa».

## Qué se hizo

- **Regla 4 de `CLAUDE.md` reescrita** (solo un administrador publica; el importador deja todo en borrador; sin raspado de páginas) y **regla 12 nueva** (países y moneda). docs/00 actualizado.
- **RN-38, RN-39, RN-40 y RNF-36** nuevos; **RN-01** exige países declarados y cobertura solo si Colombia es elegible.
- **CU-48** (importar) y **CU-49** (revisar importadas) nuevos; **CU-02, CU-07 y CU-10** modificados.
- **RF-110..117** nuevos (docs/02 §4.14); **RF-05, 09, 12 y 16** modificados.
- docs/05 **§9.36** (países, monedas, tasas) y **§9.37** (importación): 8 tablas nuevas, de la 37 a la 44, la función `registrar_importada` y el mapeo campo por campo de cada API.
- docs/04 (endpoints, Vercel Cron con `CRON_SECRET`, conectores), docs/09, docs/11 (todo en `pendiente`), docs/08 y docs/12.

## Cómo se verificó

Es especificación, sin código. Lo técnico se comprobó contra las APIs reales: en SEDIA, 31094502 es «abierta» (415 temas), 31094501 «próxima» (616) y 31094503 «cerrada»; existe la ficha JSON de cada tema; en Grants.gov, los códigos de elegibilidad 25 y 99 dan 1.218 oportunidades (publicadas y anunciadas) y los adjuntos se descargan en PDF desde `apply07.grants.gov`.

## Decisiones tomadas

- **La elegibilidad es una condición, no un criterio del porcentaje:** sumarla como sexto criterio habría cambiado todos los porcentajes existentes.
- **El país de la empresa es Colombia** (constante en una función) mientras el registro sea solo para Colombia; no se agregó una columna a `perfiles`.
- **Grants.gov y la UE no declaran países:** llegan vacíos y no se pueden publicar hasta que el administrador los fije (RN-39). No se adivinan.
- **Montos en la moneda original, con una tasa fijada por el administrador** solo para comparar. Se descartó una tasa automática: no hay una fuente gratuita para todas las monedas.

## Qué quedó abierto

Construirlo, en el orden de `ESTADO.md` → «Lo siguiente».

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: sí (RF-110..117, RNF-36 y RN-38..40 en `pendiente`)
- Siguiente paso: migración de §9.36.
