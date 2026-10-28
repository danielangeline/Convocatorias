// Lote de la sesión 032 (27-oct-2026): convocatorias vigentes verificadas contra su fuente oficial.
// Lo carga scripts/cargar-convocatorias-verificadas.mjs --lote scripts/convocatorias/lote-2026-10-27.mjs
//
// Cómo se halló cada una: Minciencias, en su listado oficial (convocatorias 54 y 55, abiertas el
// 23-oct); el Departamento de Estado, en la API pública de Grants.gov; el resto, en el Boletín de
// Oferta Internacional de Bogotá, y luego se comprobó todo en la página o el documento oficial de
// la entidad. Lo que la fuente no dice queda en null (RNF-23). Los montos en moneda extranjera
// van en la descripción, no en monto_min/monto_max, que son COP.
export const D = (nombre, archivo, tipo_doc = "TDR") => ({ nombre, archivo, tipo_doc });

export const FUENTES = {
  minciencias: { nombre: "MinCiencias", tipo_entidad: "Gobierno nacional Colombia", url: "http://minciencias.gov.co/" },
  ebafund: { nombre: "Global EbA Fund (IUCN y PNUMA)", tipo_entidad: "Cooperación internacional", url: "https://globalebafund.org" },
  rockefeller: { nombre: "The Rockefeller Foundation", tipo_entidad: "Fundación privada internacional", url: "https://www.rockefellerfoundation.org" },
  cieif: { nombre: "Climate Intervention Environmental Impact Fund (CIEIF)", tipo_entidad: "Fundación privada internacional", url: "https://cieif.org" },
  masschallenge: { nombre: "MassChallenge Switzerland", tipo_entidad: "Organización internacional", url: "https://masschallenge.org" },
  iwt: { nombre: "IWT Challenge Fund (Gobierno del Reino Unido)", tipo_entidad: "Gobierno extranjero", url: "https://iwt.challengefund.org.uk" },
  tinker: { nombre: "Fundación Tinker", tipo_entidad: "Fundación privada internacional", url: "https://tinker.org" },
  equals: { nombre: "EQUALS Global Partnership (UIT)", tipo_entidad: "Organismo multilateral", url: "https://www.equalsintech.org" },
  dos: { nombre: "Departamento de Estado de EE. UU. (Grants.gov)", tipo_entidad: "Gobierno extranjero", url: "https://www.grants.gov" },
};

export const CATEGORIAS = {
  tipo_proyecto: [
    "Investigación aplicada y CTeI", "Innovación y desarrollo tecnológico", "Financiación no reembolsable y premios",
    "Aceleración y competencia de startups", "Internacionalización y acceso a mercados", "Transformación digital",
  ],
  sector: [
    "Todos los sectores", "Energía y clima", "Medio ambiente y biodiversidad", "Agroindustria y alimentos",
    "Educación", "Gobierno y sector público", "Derechos humanos y sociedad civil", "TIC y software",
  ],
  tipo_entidad: [
    "Startup", "MiPyme", "Gran empresa o corporativo", "Institución de educación superior", "Entidad territorial",
    "Organización social y comunitaria", "ONG o sin ánimo de lucro",
  ],
};

export const CONVOCATORIAS = [
  {
    fuente: "minciencias", origen: "publico", tipo: "fondo",
    nombre: "Convocatoria 55: macroproyectos nacionales para fortalecer las capacidades científico-tecnológicas del país (SGR)",
    entidad: "Ministerio de Ciencia, Tecnología e Innovación (Minciencias)",
    descripcion:
      "Convocatoria especial para conformar un listado de macroproyectos nacionales elegibles para financiación con recursos de la Asignación para la Ciencia, Tecnología e Innovación del Sistema General de Regalías, que atiendan las demandas territoriales del bienio 2025-2026 mediante intervenciones articuladas en varias regiones. Tiene tres líneas: capacidades y servicios científico-tecnológicos compartidos; desarrollo y validación multirregional de soluciones de CTeI; y demostración, transferencia y adopción multirregional de soluciones de CTeI. Monto indicativo de $500.000 millones para unos diez macroproyectos, con hasta $50.000 millones por macroproyecto. La postulación se hace en el SIGP de Minciencias; el cierre es el 13 de noviembre de 2026 a las 4:00 p. m.",
    apertura: "2026-10-23", cierre: "2026-11-13", montoMin: null, montoMax: 50000000000,
    ubicacion: "Todo el país: el macroproyecto interviene directamente en al menos dos regiones del SGR",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://minciencias.gov.co/node/9581",
    categorias: { tipo_proyecto: ["Investigación aplicada y CTeI", "Innovación y desarrollo tecnológico"], sector: ["Todos los sectores"], tipo_entidad: ["Institución de educación superior", "Entidad territorial", "Gran empresa o corporativo", "MiPyme", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Presentarse en alianza de mínimo tres personas jurídicas nacionales distintas: una entidad proponente y al menos dos integrantes adicionales."],
      ["condicion", "La entidad proponente debe tener reconocimiento vigente de Minciencias como actor del SNCTI, o haber realizado actividades de CTeI y acreditar la idoneidad y trayectoria de los términos de referencia."],
      ["condicion", "Al menos un integrante adicional debe ser una entidad territorial, una empresa o una organización social o étnico-territorial."],
      ["condicion", "El macroproyecto debe intervenir directamente en mínimo dos regiones del SGR, con al menos un departamento de intervención directa en cada región."],
      ["documento", "Carta unificada de aval, compromiso institucional y modelo de gobernanza de la alianza (Anexo 1), documento técnico (Anexo 2) y presupuesto (Anexo 3)."],
      ["documento", "Cumplir la lista de requisitos del Anexo 12 y radicar en el SIGP antes del cierre."],
    ],
    documentos: [D("Términos de referencia de la Convocatoria 55 del SGR", "min55_tdr.pdf"), D("Anexo 12. Requisitos", "min55_req.pdf", "anexo")],
  },
  {
    fuente: "minciencias", origen: "publico", tipo: "fondo",
    nombre: "Convocatoria 54: proyectos regionales para fortalecer las capacidades científico-tecnológicas (SGR)",
    entidad: "Ministerio de Ciencia, Tecnología e Innovación (Minciencias)",
    descripcion:
      "Convocatoria especial para conformar un banco de proyectos elegibles de alcance regional, financiados con la Asignación para la Ciencia, Tecnología e Innovación del Sistema General de Regalías (actualización del bienio 2025-2026), que se ejecuten en al menos dos departamentos de una misma región del SGR. Responde a tres desafíos —vida y entorno; competitividad y economía del conocimiento; gobernanza y desarrollo social y territorial— con nueve líneas temáticas, entre ellas bioeconomía, sistemas agroalimentarios, transición energética, salud, territorios inteligentes con IA e innovación empresarial y reindustrialización. Recursos de $927.591.817.322, repartidos en partes iguales entre las seis regiones del SGR; el valor máximo por proyecto es de $17.177.626.246. Cierre el 13 de noviembre de 2026 a las 4:00 p. m.",
    apertura: "2026-10-23", cierre: "2026-11-13", montoMin: null, montoMax: 17177626246,
    ubicacion: "Todo el país: el proyecto se ejecuta en al menos dos departamentos de una misma región del SGR",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://minciencias.gov.co/node/9582",
    categorias: { tipo_proyecto: ["Investigación aplicada y CTeI", "Innovación y desarrollo tecnológico"], sector: ["Todos los sectores"], tipo_entidad: ["Institución de educación superior", "Entidad territorial", "MiPyme", "Gran empresa o corporativo", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Presentarse en alianza con, como mínimo, una institución de educación superior, otra entidad del SNCTI, una entidad territorial de la región y un actor usuario o adoptante de los resultados con representación legal (organización social, de productores, étnica o comunitaria, empresa, gremio, cámara de comercio o entidad pública usuaria)."],
      ["condicion", "La entidad proponente debe tener reconocimiento vigente de Minciencias como actor del SNCTI a la fecha de cierre, o cumplir los criterios de idoneidad y trayectoria de los términos de referencia (Decreto 1821 de 2020)."],
      ["condicion", "El proyecto debe ejecutarse en al menos dos departamentos de una misma región del SGR."],
      ["documento", "Carta unificada de aval, compromiso institucional, participación y modelo de gobernanza (Anexo 1), documento técnico (Anexo 2) y presupuesto (Anexo 3)."],
      ["documento", "Cumplir la tabla de requisitos de participación habilitantes (Anexo 14)."],
    ],
    documentos: [D("Términos de referencia de la Convocatoria 54 del SGR", "min54_tdr.pdf"), D("Anexo 14. Tabla de requisitos de participación (habilitantes)", "min54_req.pdf", "anexo")],
  },
  {
    fuente: "ebafund", origen: "cooperacion", tipo: "fondo",
    nombre: "Global EbA Fund: subvenciones medianas para adaptación al cambio climático basada en ecosistemas",
    entidad: "Global EbA Fund (UICN y PNUMA)",
    descripcion:
      "Subvenciones de hasta USD 500.000 y hasta 24 meses para proyectos de adaptación basada en ecosistemas (EbA) con potencial catalizador e innovador para superar las barreras que limitan su escalamiento. Los proyectos deben ser globales, temáticos o dirigidos a países elegibles para la Ayuda Oficial al Desarrollo (lista del CAD de la OCDE), construir sobre trabajo existente y trabajar con instituciones locales. Pueden postular ONG, organizaciones comunitarias y de pueblos indígenas, universidades, centros de investigación, organismos intergubernamentales, consorcios y, bajo ciertas condiciones, empresas privadas; los gobiernos pueden ser socios pero no recibir fondos. La postulación es en inglés por el portal de la UICN, del 12 de octubre al 16 de noviembre de 2026.",
    apertura: "2026-10-12", cierre: "2026-11-16", montoMin: null, montoMax: null,
    ubicacion: "Países elegibles para la Ayuda Oficial al Desarrollo, o proyectos globales o temáticos",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://gms-portal.iucn.org/public/calls/4c6561a2-74bc-436a-8a0c-c0eccd87fe65",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Investigación aplicada y CTeI"], sector: ["Medio ambiente y biodiversidad", "Energía y clima"], tipo_entidad: ["ONG o sin ánimo de lucro", "Organización social y comunitaria", "Institución de educación superior", "Gran empresa o corporativo"] },
    requisitos: [
      ["condicion", "Ser ONG, organización comunitaria o de pueblos indígenas, universidad, centro de investigación, organismo intergubernamental, consorcio con una organización líder o empresa privada (bajo condiciones); los gobiernos no reciben fondos directos."],
      ["condicion", "El proyecto debe calificar como adaptación basada en ecosistemas (EbA), identificar los impactos climáticos que atiende y alinearse con un objetivo estratégico y no más de dos pilares de acción."],
      ["condicion", "Presupuesto de hasta USD 500.000 y duración de 24 meses o menos, construyendo sobre trabajo existente y con plan de sostenibilidad de resultados."],
      ["condicion", "Trabajar con instituciones y organizaciones locales; la organización líder y los socios deben estar legalmente constituidos y pasar la debida diligencia del Fondo."],
      ["documento", "Incluir al menos tres indicadores del Marco de Indicadores Básicos y presentar en inglés (documentos oficiales traducidos al inglés)."],
    ],
    documentos: [D("Convocatoria de propuestas: subvenciones medianas (Global EbA Fund)", "eba_call.pdf")],
  },
  {
    fuente: "rockefeller", origen: "privado", tipo: "fondo",
    nombre: "Cities Deliver: soluciones de IA para servicios públicos en ciudades",
    entidad: "The Rockefeller Foundation y OpenAI Foundation",
    descripcion:
      "Subvenciones de 24 meses para soluciones de inteligencia artificial construidas con gobiernos de ciudad, en salud pública, movilidad económica, resiliencia ambiental o participación ciudadana (sin votaciones ni elecciones). Dos modalidades: Seed, de USD 500.000 a menos de USD 1 millón, para un primer piloto en una ciudad; y Scale, de USD 1 millón a USD 2 millones, para soluciones ya piloteadas con resultados iniciales. La primera ronda (filtro de elegibilidad y video corto) cierra el 29 de noviembre de 2026 a las 11:59 p. m. (hora del Este de EE. UU.); la segunda, por invitación, el 1 de marzo de 2027. No es obligatorio usar tecnología de OpenAI.",
    apertura: null, cierre: "2026-11-29", montoMin: null, montoMax: null,
    ubicacion: "Ciudades de cualquier país, con un gobierno de ciudad como socio",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://citiesdeliver.rockefellerfoundation.org/",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Innovación y desarrollo tecnológico", "Transformación digital"], sector: ["Gobierno y sector público", "TIC y software"], tipo_entidad: ["ONG o sin ánimo de lucro", "Institución de educación superior", "Startup", "MiPyme"] },
    requisitos: [
      ["condicion", "La organización líder debe ser sin ánimo de lucro (incluidos laboratorios universitarios y organizaciones con patrocinio fiscal) o una sociedad de beneficio público; una empresa con ánimo de lucro solo califica en casos limitados, con un proyecto benéfico y beneficio apenas incidental para su negocio."],
      ["condicion", "Tener un gobierno de ciudad como socio comprometido a colaborar; los gobiernos no pueden postularse directamente."],
      ["condicion", "El proyecto debe tener propósito benéfico (comunidades desatendidas, pobres o en dificultad, o bienestar social) e incorporar de forma significativa capacidades recientes de IA."],
      ["documento", "Primera ronda: filtro de elegibilidad y video corto en el portal, antes del 29 de noviembre de 2026."],
    ],
    documentos: [D("Página oficial de Cities Deliver (copia del 27 de octubre de 2026)", "citiesdeliver.pdf", "terminos")],
  },
  {
    fuente: "cieif", origen: "privado", tipo: "fondo",
    nombre: "CIEIF, sexta ronda: subvenciones para evaluar el impacto de tecnologías de intervención climática",
    entidad: "Climate Intervention Environmental Impact Fund (CIEIF)",
    descripcion:
      "Subvenciones de USD 75.000 para equipos que preparan la prueba de campo de una tecnología de intervención climática, destinadas a evaluación de impacto ambiental, modelación predictiva de impactos o relacionamiento con comunidades, gobiernos y otros actores potencialmente afectados. Un tercio se paga al inicio y el resto contra hitos; puede haber financiación anual repetida. Las solicitudes vencen el 1 de diciembre de 2026 y las decisiones se anuncian hacia el 1 de febrero de 2027. Antes de enviar, se contacta al fondo (info@CIEIF.org), que indica cómo entregarla.",
    apertura: null, cierre: "2026-12-01", montoMin: null, montoMax: null,
    ubicacion: "Postulantes de cualquier país",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://cieif.org/guidelines-for-grant-applicants/",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Investigación aplicada y CTeI"], sector: ["Energía y clima", "Medio ambiente y biodiversidad"], tipo_entidad: ["Startup", "Institución de educación superior", "ONG o sin ánimo de lucro"] },
    requisitos: [
      ["condicion", "La solicitud debe centrarse en al menos uno de: evaluación de impacto ambiental, modelación predictiva de impactos o relacionamiento con actores potencialmente afectados."],
      ["condicion", "La tecnología debe estar preparada para una prueba de campo, y la naturaleza de la entidad que postula debe ser clara, con sitio web propio."],
      ["documento", "Solicitud en inglés de máximo 20 páginas que responda las diez preguntas obligatorias de las guías (personal, prueba de campo, permisos, presupuesto, otras fuentes, seguros, publicación, entre otras)."],
      ["condicion", "Aceptar publicar los resultados con revisión de pares y figurar en el sitio del CIEIF. Está prohibido usar IA en la carta o la solicitud."],
    ],
    documentos: [D("Guías para solicitantes del CIEIF (copia del 27 de octubre de 2026)", "cieif.pdf", "terminos")],
  },
  {
    fuente: "masschallenge", origen: "privado", tipo: "fondo",
    nombre: "MassChallenge Switzerland: Sustainable Food Challenge 2027",
    entidad: "MassChallenge Switzerland, con Bühler, Givaudan, Mars, Louis Dreyfus Company y SIG",
    descripcion:
      "Reto para startups y scaleups de cualquier país, de etapa semilla a serie C o posterior, con soluciones en alimentos y piensos, agrotecnología, cadena de suministro, empaques o aprovechamiento de subproductos. Las seleccionadas reciben presentaciones directas a líderes de I+D, innovación abierta y sostenibilidad de las empresas aliadas, con posibles pilotos, proveeduría, empresas conjuntas o inversión, y visibilidad en el Sustainable Food Challenge Day en Suiza (junio de 2027). Postular es gratis, sin cuota ni cesión de capital. La página indica un apoyo de viaje de 1.000 (CHF en una sección, USD en otra; conviene confirmarlo con switzerland@masschallenge.org). Cierre: 25 de noviembre de 2026.",
    apertura: null, cierre: "2026-11-25", montoMin: null, montoMax: null,
    ubicacion: "Startups de cualquier país; el día del reto es presencial en Suiza",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://apply.masschallenge.org/en-us/mcch-sustainable-food-challenge-2027",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Internacionalización y acceso a mercados"], sector: ["Agroindustria y alimentos"], tipo_entidad: ["Startup", "MiPyme"] },
    requisitos: [
      ["condicion", "Startup o scaleup de etapa semilla a serie C o posterior, de cualquier país, con un prototipo o prueba de concepto funcional respaldada por datos (TRL 5)."],
      ["condicion", "La solución debe encajar con al menos una de las empresas aliadas (Bühler, Givaudan, Mars, Louis Dreyfus Company o SIG) y ser de impacto, viable y escalable."],
      ["condicion", "Estar dispuesta a colaborar y escalar con las empresas aliadas y poder viajar a Europa para el día del reto en Suiza, en junio de 2027, si es seleccionada."],
    ],
    documentos: [D("Página oficial del Sustainable Food Challenge 2027 (copia del 27 de octubre de 2026)", "masschallenge.pdf", "terminos")],
  },
  {
    fuente: "iwt", origen: "publico", tipo: "fondo",
    nombre: "IWT Challenge Fund, ronda 12 (líneas Main y Extra): proyectos contra el comercio ilegal de vida silvestre",
    entidad: "Gobierno del Reino Unido (Defra), IWT Challenge Fund",
    descripcion:
      "Fondo del Gobierno del Reino Unido para proyectos que reducen el comercio ilegal de vida silvestre y, con ello, la pobreza en países elegibles; Colombia está en la lista de 40 países elegibles de la ronda 12. Línea Main: de £75.000 a £600.000, de 1 a 3 años, para probar intervenciones innovadoras a pequeña escala. Línea Extra: de £600.000 a £1,5 millones, de 2 a 4 años, para escalar intervenciones ya probadas. Temas: reducir la demanda, marcos legales y disuasión efectivos, fortalecer la aplicación de la ley y medios de vida sostenibles para las personas afectadas. La primera etapa cierra el lunes 23 de noviembre de 2026; la segunda, solo por invitación, el 5 de abril de 2027. Se postula en el portal Flexi-Grant.",
    apertura: "2026-09-30", cierre: "2026-11-23", montoMin: null, montoMax: null,
    ubicacion: "Países elegibles de la ronda 12, entre ellos Colombia",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://bcfs.flexigrant.com/",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios"], sector: ["Medio ambiente y biodiversidad"], tipo_entidad: ["ONG o sin ánimo de lucro", "Organización social y comunitaria", "Institución de educación superior"] },
    requisitos: [
      ["condicion", "Las actividades del proyecto deben desarrollarse principalmente en los países elegibles de la tabla 4 de la guía (Colombia incluida)."],
      ["condicion", "Atender uno o más de los cuatro temas: reducir la demanda de productos del comercio ilegal, marcos legales efectivos, fortalecer la aplicación de la ley o medios de vida sostenibles para las personas afectadas."],
      ["condicion", "Main: resultados sólidos sobre el comercio ilegal y la reducción de la pobreza y potencial claro de escalar. Extra: éxito e impacto demostrados a menor escala."],
      ["documento", "Solicitud de la primera etapa en Flexi-Grant antes del 23 de noviembre de 2026, conforme a la guía para solicitantes de la ronda 12."],
    ],
    documentos: [D("Guía para solicitantes, ronda 12 del IWT Challenge Fund", "iwt_r12_guidance.pdf")],
  },
  {
    fuente: "iwt", origen: "publico", tipo: "fondo",
    nombre: "IWT Challenge Fund, ronda 12 (línea Evidence): evidencia para combatir delitos ambientales",
    entidad: "Gobierno del Reino Unido (Defra), IWT Challenge Fund",
    descripcion:
      "Línea Evidence del IWT Challenge Fund del Reino Unido: de £20.000 a £150.000, hasta por 2 años, para generar evidencia que permita diseñar intervenciones contra el comercio ilegal de vida silvestre y, a modo de prueba en esta ronda, contra otros delitos ambientales como la tala ilegal, la pesca ilegal, la minería ilegal o el tráfico de residuos. Colombia está en la lista de países elegibles de la ronda 12. Plazo único: lunes 15 de febrero de 2027, en el portal Flexi-Grant.",
    apertura: "2026-09-30", cierre: "2027-02-15", montoMin: null, montoMax: null,
    ubicacion: "Países elegibles de la ronda 12, entre ellos Colombia",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://bcfs.flexigrant.com/",
    categorias: { tipo_proyecto: ["Investigación aplicada y CTeI", "Financiación no reembolsable y premios"], sector: ["Medio ambiente y biodiversidad"], tipo_entidad: ["ONG o sin ánimo de lucro", "Institución de educación superior", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Las actividades deben desarrollarse principalmente en los países elegibles de la ronda 12 (Colombia incluida)."],
      ["condicion", "Explicar con claridad el problema de delito ambiental y cómo la evidencia generada servirá para diseñar una intervención donde hoy hay vacíos."],
      ["documento", "Solicitud en Flexi-Grant antes del 15 de febrero de 2027, conforme a la guía para solicitantes de la ronda 12."],
    ],
    documentos: [D("Guía para solicitantes, ronda 12 del IWT Challenge Fund", "iwt_r12_guidance.pdf")],
  },
  {
    fuente: "tinker", origen: "privado", tipo: "fondo",
    nombre: "Fundación Tinker: subvenciones institucionales 2027 (gobernanza democrática y educación)",
    entidad: "Fundación Tinker",
    descripcion:
      "Único ciclo de subvenciones de la Fundación Tinker en 2027, para proyectos de gobernanza democrática o educación en países de habla hispana o portuguesa de América Latina, incluida Colombia: investigación, incidencia en políticas públicas, experimentación, escalamiento de intervenciones y conocimiento. Subvenciones de hasta tres años, en general con pagos anuales de USD 50.000 a USD 150.000 (también se consideran montos menores). La carta de consulta se recibe del 6 al 19 de enero de 2027 (11:59 p. m., hora del Este) en el portal Fluxx; la propuesta completa, solo por invitación, vence el 25 de marzo de 2027 y la decisión llega en julio de 2027.",
    apertura: "2027-01-06", cierre: "2027-01-19", montoMin: null, montoMax: null,
    ubicacion: "Proyectos en países de habla hispana o portuguesa de América Latina, entre ellos Colombia",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://tinker.fluxx.io/user_sessions/new",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Investigación aplicada y CTeI"], sector: ["Educación", "Gobierno y sector público", "Derechos humanos y sociedad civil"], tipo_entidad: ["ONG o sin ánimo de lucro", "Institución de educación superior", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Ser organización sin fines de lucro (501(c)(3) en EE. UU. o su equivalente fuera; las latinoamericanas no necesitan serlo), o tener patrocinador fiscal."],
      ["condicion", "Haber operado con un presupuesto de USD 50.000 o más en 2024, 2025 o 2026."],
      ["condicion", "El proyecto debe enfocarse en países de habla hispana o portuguesa de América Latina y alinearse con Gobernanza Democrática o Educación. No financia personas, cabildeo, recaudación anual, becas, construcción, cine, radio o TV, colecciones de arte ni dotaciones."],
      ["documento", "Cuestionario de elegibilidad y carta de consulta de unas 1.000 palabras en el portal Fluxx, entre el 6 y el 19 de enero de 2027."],
    ],
    documentos: [D("Página oficial de la convocatoria 2027 de la Fundación Tinker (copia del 27 de octubre de 2026)", "tinker.pdf", "terminos")],
  },
  {
    fuente: "equals", origen: "cooperacion", tipo: "fondo",
    nombre: "EQUALS in Tech Awards 2027: premios a iniciativas de igualdad de género en tecnología",
    entidad: "EQUALS Global Partnership (Unión Internacional de Telecomunicaciones)",
    descripcion:
      "Premios internacionales a programas o proyectos en curso que amplían las oportunidades de mujeres y niñas en la tecnología, en tres categorías: tecnologías emergentes para la inclusión (IA, tecnologías climáticas y otras), habilidades digitales y rutas de liderazgo, y espacios digitales seguros e inclusivos. Abiertos a organizaciones de cualquier región: sociedad civil, gobiernos, organismos internacionales, academia, empresas, emprendimientos y empresas sociales. Las ganadoras reciben reconocimiento de la alianza EQUALS y acceso a su red; la página no menciona premio en dinero. Cierre: 7 de noviembre de 2026, 11:59 p. m. (hora de Europa Central).",
    apertura: "2026-10-07", cierre: "2026-11-07", montoMin: null, montoMax: null,
    ubicacion: "Organizaciones de cualquier país",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://forms.gle/c9dcvc55qDX4GME48",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Transformación digital"], sector: ["TIC y software", "Educación"], tipo_entidad: ["ONG o sin ánimo de lucro", "Startup", "MiPyme", "Gran empresa o corporativo", "Entidad territorial", "Institución de educación superior"] },
    requisitos: [
      ["condicion", "Postular un programa, iniciativa o proyecto específico alineado con una categoría; no se aceptan postulaciones de la organización en su conjunto."],
      ["condicion", "El trabajo debe estar en curso, no concluido, al momento de postular."],
      ["documento", "Formulario de postulación en línea antes del 7 de noviembre de 2026; se evalúan impacto, alcance, escalabilidad, innovación y colaboración."],
    ],
    documentos: [D("Página oficial de los EQUALS in Tech Awards 2027 (copia del 27 de octubre de 2026)", "equals.pdf", "terminos")],
  },
  {
    fuente: "dos", origen: "publico", tipo: "fondo",
    nombre: "Departamento de Estado de EE. UU. (DRL/IRF): solicitud global de declaraciones de interés en libertad religiosa, año fiscal 2026",
    entidad: "Oficina de Democracia, Derechos Humanos y Trabajo del Departamento de Estado de EE. UU.",
    descripcion:
      "Convocatoria global abierta (DFOP0019929, publicada en Grants.gov el 26 de octubre de 2026) para presentar declaraciones de interés de programas que promuevan la libertad religiosa y atiendan restricciones a ella, en uno o varios países y en línea con los objetivos de política exterior de EE. UU. Cada organización puede presentar hasta cinco como titular. Se esperan unas 50 adjudicaciones de USD 1 millón a USD 3 millones; no exige contrapartida. Cierre: 7 de diciembre de 2026.",
    apertura: "2026-10-26", cierre: "2026-12-07", montoMin: null, montoMax: null,
    ubicacion: "Convocatoria global: proyectos en uno o varios países",
    nacional: true,
    paises: ["CO"], // RN-39: todas admiten organizaciones de Colombia (verificado al cargarlas)
    url: "https://www.grants.gov/search-results-detail/364149",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios"], sector: ["Derechos humanos y sociedad civil"], tipo_entidad: ["ONG o sin ánimo de lucro", "Institución de educación superior", "Gran empresa o corporativo", "MiPyme"] },
    requisitos: [
      ["condicion", "Ser ONG u organización sin ánimo de lucro extranjera o de EE. UU., organismo internacional público, institución de educación superior o empresa con ánimo de lucro."],
      ["condicion", "La programación propuesta debe atender restricciones a la libertad religiosa y estar en línea con los objetivos de política exterior de EE. UU."],
      ["documento", "Declaración de interés (hasta cinco por organización como titular) antes del 7 de diciembre de 2026, según el aviso DFOP0019929 en Grants.gov."],
    ],
    documentos: [D("Ficha oficial de la oportunidad DFOP0019929 en Grants.gov (copia del 27 de octubre de 2026)", "drl.pdf", "terminos")],
  },
];
