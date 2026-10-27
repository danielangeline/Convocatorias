# Fuentes de convocatorias e integraciones posibles

> Investigación de la sesión 032 (27 de octubre de 2026), a pedido del Product Owner: «mantener la base de convocatorias siempre actualizada, con fondos de todos los países».
> **Esto no es especificación.** Fue el insumo para decidir. **Decidido en la sesión 032 por el Product Owner:** importar a borrador desde Grants.gov, la UE e iNNpulsa, con país de elegibilidad y moneda. Ya está especificado: regla 4 de `CLAUDE.md`, RN-38..40, RNF-36, CU-48, CU-49, RF-110..117, docs/05 §9.36 y §9.37. Si este documento y la especificación se contradicen, gana la especificación.

---

## 1. Fuentes con API gratuita (probadas el 27-oct-2026)

| Fuente | Qué trae | Acceso | Probado |
|---|---|---|---|
| **Grants.gov** (Gobierno de EE. UU.) | Todas las subvenciones federales de EE. UU.: título, agencia, apertura, cierre, montos, elegibilidad, descripción | **Gratis, sin clave.** `POST https://api.grants.gov/v1/api/search2` (búsqueda) y `POST /v1/api/fetchOpportunity` (detalle) | Sí: 411 abiertas con «small business»; detalle completo de DFOP0019929 |
| **Simpler.Grants.gov** (nueva API de Grants.gov) | Lo mismo, con API REST moderna | **Gratis, con clave** que se pide en el sitio | La documentación responde 200; falta pedir la clave |
| **Portal de Financiación y Licitaciones de la UE** (SEDIA) | Convocatorias de Horizonte Europa, LIFE, Europa Digital, EIC y demás programas de la UE, con fechas y estado | **Gratis.** `POST https://api.tech.ec.europa.eu/search-api/prod/rest/search?apiKey=SEDIA` (la clave `SEDIA` es pública) | Sí: 616 temas abiertos o próximos |
| **iNNpulsa Colombia** | Todas sus convocatorias con fechas, términos y enlace | **Gratis, sin clave.** `GET https://convocatorias.innpulsacolombia.com/api/convocatorias` | Sí: 75 registros. Ojo: marca «abierta» convocatorias con cierre vencido; hay que filtrar por `end_date` |
| **UKRI** (Reino Unido) | Oportunidades de financiación de UK Research and Innovation | **Gratis.** RSS en `https://www.ukri.org/opportunity/feed/` | Sí |
| **Banco Mundial** | Avisos de adquisiciones de sus proyectos (licitaciones, no subvenciones) | **Gratis.** `https://search.worldbank.org/api/v2/procnotices` | Sí: 424.265 avisos |
| **SECOP II** (datos.gov.co) | Procesos de contratación pública de Colombia (licitaciones, no fondos) | **Gratis.** API Socrata de datos abiertos | Sí |

**Lo que trae cada una no es igual de útil.** Grants.gov y la UE tienen miles de convocatorias, pero casi todas exigen ser entidad de EE. UU. o de un país europeo o asociado; Colombia no es país asociado a Horizonte Europa y en general sus entidades solo entran como socias de un consorcio. Banco Mundial y SECOP son contratación pública, no financiación. Para empresas colombianas, lo más rendidor es iNNpulsa, el filtro de Grants.gov por elegibilidad «extranjeros» y los temas de la UE abiertos a terceros países.

## 2. Fuentes sin API, gratuitas, que se revisan a mano o con un lector de páginas

| Fuente | Qué trae | Nota |
|---|---|---|
| **Minciencias** — `minciencias.gov.co/convocatorias/todas` | Convocatorias del SGR y de Minciencias con TDR y anexos en PDF | Página estable; el listado es HTML y la ficha trae cronograma y documentos |
| **Boletín de Oferta Internacional de Bogotá** — `bogota.gov.co/boletin-de-oferta-internacional/` | ~150 oportunidades internacionales con fecha de cierre, curadas para Colombia | La mejor fuente gratuita encontrada para lo internacional. Mezcla fondos con becas y cursos: hay que filtrar |
| Portales de MinTIC, MinCIT, MinCultura, SENA (Fondo Emprender), Ruta N, CoCrea | Convocatorias nacionales y regionales | Cada uno con su formato |
| Embajadas (EE. UU., Reino Unido, UE en Colombia), BID Lab, CAF, PNUMA, UICN | Fondos de cooperación | Publican en su sitio; varios ya llegan por el boletín de Bogotá |

## 3. Plataformas de pago (precios encontrados el 27-oct-2026; confirmar con cada proveedor)

| Plataforma | Qué ofrece | Precio | API |
|---|---|---|---|
| **OpenGrants** | 75.800+ subvenciones, 27.200+ contratos, 5.800+ financiadores, actualización diaria | Pro USD 8–9/mes; **Developer USD 239–299/mes** con API ilimitada | Sí (plan Developer) |
| **GrantExec** (Euna Solutions) | Base de subvenciones de EE. UU. | Planes hasta USD 242/mes; API aparte, por uso | Sí, plan aparte |
| **Devex Pro Funding** | Licitaciones, subvenciones y adjudicaciones de 850+ financiadores del desarrollo, mundial | USD 83/mes anual o 149/mes; descuentos para países de ingreso medio | No hay API pública |
| **Raspadores de Grants.gov en Apify** | Lo mismo que la API gratuita de Grants.gov | USD 1,50 a 9,23 por cada 1.000 registros | Sí, pero no tiene sentido pagar: la fuente oficial es gratis |
| Instrumentl, GrantForward, Candid (Foundation Directory), fundsforNGOs Premium | Bases de fundaciones privadas | Sin precio confirmado en esta búsqueda; son suscripciones anuales | No confirmada |

**Recomendación:** empezar solo con fuentes gratuitas. Ninguna de pago cubre bien a Colombia ni a América Latina; su fuerte son las fundaciones de EE. UU. Si más adelante se quiere volumen de fundaciones privadas, OpenGrants Developer es la única con API abierta y precio publicado.

## 4. China, Ecuador y otros países

- **China:** no se encontró ninguna fuente oficial con convocatorias abiertas a empresas extranjeras. Lo más cercano es el **Kunming Biodiversity Fund** (iniciativa de China administrada con el PNUMA): segunda etapa hasta el 15-nov-2026, pero solo postulan agencias de la ONU con socios del país. No se cargó porque una empresa no puede postularse directamente.
- **Taiwán:** la Taiwan Foundation for Democracy tiene ronda hasta el 15-dic-2026, enfocada en Asia Oriental. No se cargó por falta de encaje.
- **Ecuador:** sus fondos (FonQuito, OIM, Misión Emprende 593) son solo para residentes en Ecuador y los de 2026 ya cerraron o no publican fecha.
- **Chile, Perú, México:** CORFO, ProInnóvate y similares exigen estar constituido en el país. Start-Up Chile sí admite extranjeros; su última convocatoria cerró el 25-may-2026.

## 5. Cómo se integraría *(propuesta de la sesión 032, ya especificada: ver CU-48 y docs/05 §9.37)*

1. **Importador por fuente**, como tarea programada diaria (Vercel Cron o pg_cron, que ya existe): lee la API, filtra lo vigente y lo elegible, y **crea la convocatoria en estado `borrador`** con su fuente, fechas, enlace y la copia del documento oficial.
2. **El administrador revisa y publica** desde el panel, como hoy. Eso mantiene RN-01 (ficha completa) y RNF-23 (nada inventado: requisitos y categorías los confirma una persona).
3. **Idempotencia:** guardar el identificador externo (`fuente_externa`, `id_externo`) para no duplicar y para despublicar sola la que la fuente cierre o cancele.
4. **Lo que hay que decidir antes de programarlo:**
   - **Cambiar la regla 4** («sin scraping en el MVP») para admitir importación automática a borrador.
   - **País de elegibilidad.** Hoy una convocatoria es «cobertura nacional» o por departamentos de Colombia. Si entran convocatorias de cualquier país, hace falta una columna de países elegibles, o las sugerencias le mostrarían a una empresa colombiana fondos que no puede pedir.
   - **Moneda.** `monto_min` y `monto_max` son COP. Para comparar fondos en USD, EUR o GBP hace falta guardar la moneda original.
   - **«Sin fecha de cierre»** (pendiente desde la sesión 029): las ventanas permanentes (FID, DIV Fund, ScotiaRISE, Pollination Project, WPHF, Rockstart, PLAI) no entran mientras `fecha_cierre` sea obligatoria.

## 6. Mientras tanto: carga manual por lotes

Cada búsqueda queda en un archivo de lote y se carga con el mismo script, que valida RN-01 antes de publicar:

```bash
node --env-file=.env.local scripts/cargar-convocatorias-verificadas.mjs --lote scripts/convocatorias/lote-2026-10-27.mjs
```

Con `--aplicar` escribe. `DOCS_DIR` apunta a la carpeta con los PDF oficiales que cita el lote.
