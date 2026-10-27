# Sesión 032 · 2026-10-27

**Sprint:** 5 · día 12 de 30
**Duración aproximada:** 2 h
**Commits:** ver el historial de `sprint-2` (un solo commit de trabajo y cierre)

---

## Objetivo de la sesión

Pedido del Product Owner: buscar «muchísimas» convocatorias vigentes de cualquier país (Colombia, China, Ecuador, EE. UU., Reino Unido…), públicas y privadas, agregarlas enseguida, y encontrar APIs o plataformas para mantener la base siempre al día, **diciendo antes si son de pago**.

## Qué se hizo

- **Carga de convocatorias (RF-05, RF-06, RF-07, RF-08, RF-09, RF-102, RN-01, RN-34)** — 11 nuevas, `publicada`, con ficha completa (cobertura, categorías, 3 a 6 requisitos sacados de la fuente, documento oficial en el bucket y enlace de postulación):
  - **Colombia (2):** Minciencias, convocatorias 54 (proyectos regionales, hasta $17.177 millones por proyecto) y 55 (macroproyectos nacionales, hasta $50.000 millones), ambas del SGR, abiertas el 23-oct y con cierre el 13-nov a las 4:00 p. m. Se adjuntaron el TDR y el anexo de requisitos de cada una.
  - **Internacionales abiertas a organizaciones de Colombia (9):** Global EbA Fund (UICN y PNUMA, hasta USD 500.000, cierre 16-nov), Cities Deliver (Rockefeller y OpenAI Foundation, USD 0,5 a 2 millones, 29-nov), CIEIF sexta ronda (USD 75.000, 1-dic), MassChallenge Sustainable Food Challenge 2027 (25-nov), IWT Challenge Fund ronda 12 del Reino Unido, Main/Extra (23-nov) y Evidence (15-feb-2027), con Colombia en la lista de países elegibles, Fundación Tinker 2027 (carta de consulta 6 al 19-ene-2027), EQUALS in Tech Awards 2027 (UIT, 7-nov) y la solicitud global DRL/IRF del Departamento de Estado de EE. UU. (USD 1 a 3 millones, 7-dic).
  - Fuentes nuevas: 8. Categorías nuevas de sector: medio ambiente y biodiversidad, agroindustria y alimentos, educación, gobierno y sector público, derechos humanos y sociedad civil.
- **Script de carga por lotes.** `scripts/cargar-convocatorias-verificadas.mjs` ahora recibe `--lote <archivo>`; los datos de la sesión 029 pasaron a `scripts/convocatorias/lote-2026-10-21.mjs` y los de hoy a `lote-2026-10-27.mjs`. Cada convocatoria declara `origen` y `tipo` (RF-102) y el script valida además que la apertura no sea posterior al cierre.
- **Estudio de fuentes e integraciones** — `docs/12-fuentes-de-convocatorias.md` (nuevo, investigación, no especificación): APIs gratuitas, fuentes gratuitas sin API, plataformas de pago con precio, lo que se encontró para China, Ecuador y otros países, y una propuesta de importador para decidir.

Ningún requerimiento cambió de estado en `docs/11-avance-por-requerimiento.md`: la carga usa lo que ya estaba construido.

## Cómo se verificó

- **APIs, con llamadas reales:** Grants.gov `search2` (411 abiertas con «small business») y `fetchOpportunity` (detalle de DFOP0019929, con elegibilidad que incluye empresas con ánimo de lucro y ONG extranjeras); UE SEDIA con la clave pública `SEDIA` (616 temas abiertos o próximos); iNNpulsa `/api/convocatorias` (75 registros, ninguna nueva con cierre futuro: las vigentes ya estaban cargadas); RSS de UKRI, API de adquisiciones del Banco Mundial y SECOP en datos.gov.co, todas respondiendo.
- **Cada convocatoria, en su fuente oficial**, no en el resumen que la trajo: la ficha de Minciencias y el cronograma del TDR 54 («Cierre de la convocatoria 13 de noviembre de 2026 a las 16:00»); la guía de la ronda 12 del IWT (tabla 4 de países elegibles, con Colombia); la página oficial de cada programa leída con un navegador sin ventana (Playwright), que también generó la copia en PDF rotulada «copia del 27 de octubre de 2026». Dos copias pasaban de 27 y 13 MB y se rehicieron sin imágenes para respetar el límite de 20 MB del bucket.
- **Escritura:** simulacro (11 por crear, 0 problemas) y luego `--aplicar`: 11 creadas y publicadas, 0 problemas; el script comprueba RN-01 antes de publicar porque la clave de servicio se salta la RLS. Consulta posterior: 22 convocatorias `publicada` con cierre desde hoy (10 públicas, 8 privadas, 4 de cooperación). `eslint` limpio sobre los scripts.
- **No se recorrió en pantalla.** La carga usa el mismo camino que la sesión 029, que sí se recorrió.

## Decisiones tomadas

- **Solo se cargó lo que una organización de Colombia puede pedir.** Se descartaron las miles de Grants.gov y de la UE que exigen ser de EE. UU. o de Europa: el modelo solo conoce cobertura en Colombia, y las sugerencias (CU-10) se las mostrarían como compatibles a una empresa que no puede postular. Queda como decisión del Product Owner un campo de país de elegibilidad.
- **No se programó ningún importador automático.** La regla 4 de `CLAUDE.md` dice «sin scraping en el MVP»; cambiarla es del Product Owner y se especifica primero. Se dejó la propuesta (importar a borrador y que el administrador publique) en `docs/12` §5.
- **Siguen fuera las convocatorias sin fecha de cierre** (FID, DIV Fund, ScotiaRISE, Pollination Project, WPHF, Rockstart, PLAI): `fecha_cierre` es obligatoria y la decisión de la sesión 029 sigue abierta.
- **Fuera por falta de encaje:** Kunming Biodiversity Fund (solo postulan agencias de la ONU), Taiwan Foundation for Democracy (enfocada en Asia Oriental), Startup Wise Guys (inversión con cuota de participación de €35.000, no subvención), MIT Solve (cierra el 2-nov y su página no mostró las bases) y el «Advancing Global Health» del Departamento de Estado (marco general que se activa por adendas).
- **Montos en moneda extranjera en la descripción**, como en la sesión 029: las columnas son COP y convertir sería un dato que la fuente no da.
- **Recomendación sobre plataformas de pago: ninguna por ahora.** Cubren sobre todo fundaciones de EE. UU.; para Colombia y América Latina rinden más las fuentes gratuitas.

## Qué quedó abierto

- **Decisiones del Product Owner:** importación automática a borrador (cambia la regla 4), país de elegibilidad y moneda (ver `ESTADO.md`, decisiones abiertas), y lo de «sin fecha de cierre» (sesión 029).
- **Revisión experta (RNF-23)** de los 11 textos nuevos.
- **Volver a buscar cada mes:** el boletín de Bogotá y el listado de Minciencias son las fuentes gratuitas que más rinden; el script es idempotente y cada búsqueda queda como un lote.

## Hallazgos no planificados

- La API de iNNpulsa marca como «abierta» convocatorias con `end_date` vencido. Anotado en `ESTADO.md`.

## Estado al cerrar

- `ESTADO.md` actualizado: sí
- `docs/11-avance-por-requerimiento.md` actualizado: no hacía falta (ningún requerimiento cambió de estado)
- `tsc --noEmit` y `lint` limpios: `eslint` limpio en los scripts tocados; no se tocó TypeScript
- Siguiente paso: que el Product Owner decida sobre la importación automática y el país de elegibilidad; con eso, especificar el importador de Grants.gov, UE e iNNpulsa.
