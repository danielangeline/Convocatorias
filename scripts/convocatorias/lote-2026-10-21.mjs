// Lote de la sesión 029 (21-oct-2026): 12 convocatorias vigentes verificadas contra su fuente oficial.
// Lo carga scripts/cargar-convocatorias-verificadas.mjs --lote scripts/convocatorias/lote-2026-10-21.mjs
// No declara `origen` (RF-102 llegó después): se fijó en la base en la sesión 031 y el cargador omite las que ya existen.
// ---------------------------------------------------------------------------
// Fuentes y categorías
// ---------------------------------------------------------------------------
export const FUENTES = {
  innpulsa: { nombre: "iNNpulsa Colombia", tipo_entidad: "Gobierno nacional Colombia", url: "https://convocatorias.innpulsacolombia.com" },
  minciencias: { nombre: "MinCiencias", tipo_entidad: "Gobierno nacional Colombia", url: "http://minciencias.gov.co/" },
  gamic: { nombre: "Michigan Innovation Alliance (GAMIC)", tipo_entidad: "Organización internacional", url: "https://gamicevent.org" },
  emerge: { nombre: "eMerge Americas", tipo_entidad: "Organización internacional", url: "https://emergeamericas.com" },
  eulac: { nombre: "EU-LAC Digital Accelerator", tipo_entidad: "Cooperación internacional", url: "https://eulacdigitalaccelerator.com" },
  unicef: { nombre: "UNICEF Venture Fund", tipo_entidad: "Organismo multilateral", url: "https://www.unicef.org/innovation" },
  bnef: { nombre: "BloombergNEF", tipo_entidad: "Organización internacional", url: "https://about.bnef.com" },
  southsummit: { nombre: "South Summit", tipo_entidad: "Organización internacional", url: "https://www.southsummit.io" },
};

export const CATEGORIAS = {
  tipo_proyecto: [
    "Asistencia técnica y fortalecimiento productivo", "Calidad y certificación", "Innovación y desarrollo tecnológico",
    "Investigación aplicada y CTeI", "Transformación digital", "Aceleración y competencia de startups",
    "Internacionalización y acceso a mercados", "Financiación no reembolsable y premios", "Logística y cadena de suministro",
  ],
  sector: [
    "TIC y software", "Todos los sectores", "Manufactura e industria", "Automotriz y movilidad", "Salud y ciencias de la vida",
    "Energía y clima", "Fintech y Web3", "Gestión del riesgo y reconstrucción territorial",
  ],
  tipo_entidad: [
    "Startup", "MiPyme", "Unidad productiva y economía popular", "Gran empresa o corporativo", "Institución de educación superior",
    "Entidad territorial", "Organización social y comunitaria", "ONG o sin ánimo de lucro",
  ],
};

// ---------------------------------------------------------------------------
// Las convocatorias. `fuenteOficial` es la página que se comprobó el 21-oct-2026.
// ---------------------------------------------------------------------------
export const D = (nombre, archivo, tipo_doc = "TDR") => ({ nombre, archivo, tipo_doc });
export const CONVOCATORIAS = [
  {
    fuente: "innpulsa",
    nombre: "Formación y asistencia técnica en calidad para mipymes: IATF 16949:2016 (cadena automotriz y de motopartes)",
    entidad: "iNNpulsa Colombia, ONUDI y MinCIT",
    descripcion:
      "Asistencia técnica especializada para que mipymes proveedoras de la cadena automotriz y de motopartes implementen un sistema de gestión de la calidad conforme a la norma IATF 16949:2016. Son unas 50 horas de asesoría individual con un consultor (25 virtuales y 25 presenciales) durante cerca de tres meses, con formación inicial para la alta dirección, diagnóstico técnico, plan de trabajo individual y acompañamiento. Convocatoria territorial focalizada en Antioquia, Bogotá D.C., Caldas, Cundinamarca, Quindío, Risaralda y Valle del Cauca. No son elegibles las empresas que ya tengan la certificación.",
    apertura: "2026-09-29", cierre: "2026-11-04", montoMin: null, montoMax: null,
    ubicacion: "Antioquia, Bogotá D.C., Caldas, Cundinamarca, Quindío, Risaralda y Valle del Cauca",
    deptos: ["Antioquia", "Bogotá", "Caldas", "Cundinamarca", "Quindío", "Risaralda", "Valle del Cauca"],
    url: "https://forms.cloud.microsoft/pages/responsepage.aspx?id=MUlqQlzsy0-dEDNj69-SgGW7KKOFfNBCuwR0BbSlj-hUNEFRQkVOMFhNVkNRSllSVExCMVVCV1UwTy4u&route=shorturl",
    categorias: { tipo_proyecto: ["Calidad y certificación", "Asistencia técnica y fortalecimiento productivo"], sector: ["Automotriz y movilidad", "Manufactura e industria"], tipo_entidad: ["MiPyme"] },
    requisitos: [
      ["condicion", "Ser micro, pequeña o mediana empresa (Decreto 957 de 2019) con al menos un año de constitución."],
      ["condicion", "Estar ubicada en Antioquia, Bogotá D.C., Caldas, Cundinamarca, Quindío, Risaralda o Valle del Cauca."],
      ["condicion", "Desarrollar una actividad económica de la cadena de valor automotriz y de motopartes (Anexo IV de actividades económicas)."],
      ["condicion", "Tener al menos 5 trabajadores con contrato laboral vigente y un líder de implementación dentro de la empresa."],
      ["documento", "Registro mercantil activo y actualizado."],
      ["condicion", "No estar en causal de disolución o liquidación ni tener ya la certificación IATF 16949:2016."],
      ["documento", "Carta de compromiso de la alta gerencia (Anexo II) y certificado de no causal de disolución (Anexo III)."],
      ["condicion", "Realizar el autodiagnóstico en el formulario de inscripción y no ser beneficiaria actual de programas cofinanciados por MinCIT e iNNpulsa en 2026."],
    ],
    documentos: [D("Términos de referencia IATF 16949 (convocatoria 3)", "6abd2b006192da7703399a43_0.pdf"), D("Anexo IV: actividades económicas de la cadena automotriz", "6abd2b006192da7703399a43_3.pdf", "anexo")],
    oficial: "https://convocatorias.innpulsacolombia.com/convocatoria/formacion-y-asistencia-tecnica-en-calidad-para-mipymes-convocatoria-territorial--o2q9yw",
  },
  {
    fuente: "innpulsa",
    nombre: "ZASCA Tecnologías Honda, norte del Tolima y Guaduas (postulación presencial)",
    entidad: "iNNpulsa Colombia y Cámara de Comercio de Honda, Guaduas y Norte del Tolima",
    descripcion:
      "Centro de Reindustrialización ZASCA Tecnologías: vincula a 200 unidades productivas y mipymes de cualquier sector ubicadas en Honda, Ambalema, Armero, Guayabal, Fresno, Casablanca, Herveo, Lérida, Líbano, Mariquita, Murillo, Palocabildo y Villahermosa (Tolima) y en Guaduas (Cundinamarca). Ofrece asistencia técnica individual y grupal, innovación incremental, creación de valor agregado, relacionamiento comercial y aplicación de tecnología, en dos componentes: exploración tecnológica (150 cupos) y apropiación y transformación tecnológica (50 cupos). La postulación solo es presencial en el centro de Honda (calle 12A # 10A-06).",
    apertura: "2026-05-14", cierre: "2026-11-30", montoMin: null, montoMax: null,
    ubicacion: "Honda, Ambalema, Armero, Guayabal, Fresno, Casablanca, Herveo, Lérida, Líbano, Mariquita, Murillo, Palocabildo y Villahermosa (Tolima) y Guaduas (Cundinamarca)",
    deptos: ["Tolima", "Cundinamarca"],
    url: "https://convocatorias.innpulsacolombia.com/convocatoria/zasca-tecnologias-honda-norte-del-tolima-y-guaduas-postulacion-presencial-rg0fa",
    categorias: { tipo_proyecto: ["Asistencia técnica y fortalecimiento productivo", "Transformación digital"], sector: ["Todos los sectores"], tipo_entidad: ["MiPyme", "Unidad productiva y economía popular"] },
    requisitos: [
      ["condicion", "Ser unidad productiva o mipyme de cualquier sector, con domicilio en uno de los municipios cubiertos."],
      ["condicion", "Contar con mínimo 12 meses de antigüedad en la actividad económica."],
      ["condicion", "Demostrar al menos dos personas vinculadas, mayores de edad. Contar con RUT o registro mercantil no es excluyente."],
      ["condicion", "Postularse de manera presencial en el centro ZASCA Tecnologías de Honda (calle 12A # 10A-06) y hacer el registro único de iNNpulsa y el perfilamiento tecnológico."],
    ],
    documentos: [D("Convocatoria ZASCA Tecnologías Honda (términos de referencia)", "6a064b096f969f885f4b2b12_0.pdf")],
    oficial: "https://convocatorias.innpulsacolombia.com/convocatoria/zasca-tecnologias-honda-norte-del-tolima-y-guaduas-postulacion-presencial-rg0fa",
  },
  {
    fuente: "innpulsa",
    nombre: "ZASCA Tecnologías Norte de Santander, cohorte 2 (postulación presencial)",
    entidad: "iNNpulsa Colombia y Cámara de Comercio de Cúcuta",
    descripcion:
      "Centro de Reindustrialización ZASCA Tecnologías: vincula a 300 unidades productivas y mipymes de cualquier sector ubicadas en el departamento de Norte de Santander, con asistencia técnica individual y grupal, innovación incremental, valor agregado, relacionamiento comercial y aplicación de tecnología, en dos componentes de 150 cupos cada uno (exploración tecnológica, y apropiación y transformación tecnológica). La postulación solo es presencial en el edificio de la Cámara de Comercio de Cúcuta (calle 10 # 4-38, piso 7, torre A).",
    apertura: "2026-04-30", cierre: "2026-12-02", montoMin: null, montoMax: null,
    ubicacion: "Municipios del departamento de Norte de Santander",
    deptos: ["Norte de Santander"],
    url: "https://convocatorias.innpulsacolombia.com/convocatoria/69f3d045a338026cc9d9e0f2",
    categorias: { tipo_proyecto: ["Asistencia técnica y fortalecimiento productivo", "Transformación digital"], sector: ["Todos los sectores"], tipo_entidad: ["MiPyme", "Unidad productiva y economía popular"] },
    requisitos: [
      ["condicion", "Ser unidad productiva o mipyme de cualquier sector, con domicilio en Norte de Santander."],
      ["condicion", "Contar con mínimo 12 meses de antigüedad en la actividad económica."],
      ["condicion", "Demostrar al menos dos personas vinculadas, mayores de edad. Contar con RUT o registro mercantil no es excluyente."],
      ["condicion", "Postularse de manera presencial en el ZASCA Tecnologías de la Cámara de Comercio de Cúcuta y hacer el registro único de iNNpulsa y el perfilamiento tecnológico."],
    ],
    documentos: [D("Convocatoria ZASCA Tecnologías Norte de Santander (términos de referencia)", "69f3d045a338026cc9d9e0f2_0.pdf")],
    oficial: "https://convocatorias.innpulsacolombia.com/convocatoria/69f3d045a338026cc9d9e0f2",
  },
  {
    fuente: "innpulsa",
    nombre: "Servicios complementarios logísticos, de colaboración y códigos de barras GS1",
    entidad: "iNNpulsa Colombia, MinCIT y LOGYCA / Asociación",
    descripcion:
      "Alianza de MinCIT, iNNpulsa Colombia y LOGYCA / Asociación para que mipymes y unidades productivas de todo el país accedan gratis a siete servicios bajo el estándar internacional GS1: códigos de barras (GTIN13, GS1-128 y GLN), plataforma LOGYCA / Colabora, asesoría LOGYCA / Crecemype, tarjeta de presentación digital, autodiagnóstico logístico, autodiagnóstico de colaboración y kit de productividad.",
    apertura: "2026-03-18", cierre: "2026-10-31", montoMin: null, montoMax: null,
    ubicacion: "Todo el territorio nacional",
    nacional: true,
    url: "https://logyca.odoo.com/es_CO/innpulsa/postulacion",
    categorias: { tipo_proyecto: ["Logística y cadena de suministro", "Asistencia técnica y fortalecimiento productivo"], sector: ["Todos los sectores"], tipo_entidad: ["MiPyme", "Unidad productiva y economía popular"] },
    requisitos: [
      ["condicion", "Ser micro, pequeña o mediana empresa legalmente constituida (Decreto 957 de 2019)."],
      ["condicion", "No ser miembro de LOGYCA / Asociación o tener una vinculación inactiva."],
      ["condicion", "No estar inhabilitada por no participar en el sondeo de Colombia Productiva y LOGYCA."],
      ["documento", "Carta de compromiso firmada por el representante legal, adjunta al formulario de postulación."],
    ],
    documentos: [D("Página oficial de la convocatoria (copia del 21 de octubre de 2026)", "logistica.pdf", "terminos")],
    oficial: "https://convocatorias.innpulsacolombia.com/convocatoria/69bb119298e5068a5213f26c",
  },
  {
    fuente: "minciencias",
    nombre: "Convocatoria 56: emergencia para la recuperación y generación de capacidades transformadoras (SGR, Decreto 1414 de 2026)",
    entidad: "Minciencias, Asignación para la CTeI del Sistema General de Regalías",
    descripcion:
      "Conforma un banco de proyectos elegibles de ciencia, tecnología e innovación, financiables con la Asignación para la CTeI del SGR, para adaptar, validar, transferir, apropiar o escalar tecnologías e innovaciones que atiendan la recuperación y reconstrucción de los territorios afectados por la emergencia. Recursos por $700.000.000.000, con hasta $14.000.000.000 por proyecto y 24 meses de ejecución; se espera financiar 10 proyectos en cada una de las cinco líneas: gestión anticipada del riesgo, reconstrucción sostenible, protección de la vida y recuperación social, empresas de base científica y tecnológica, y ecosistemas de conocimiento. Se postula una alianza con al menos una IES y una entidad territorial de los departamentos afectados, más un actor del SNCTI, del sector productivo o de la sociedad civil.",
    apertura: "2026-10-08", cierre: "2026-11-03", montoMin: null, montoMax: 14000000000,
    ubicacion: "Dieciséis departamentos afectados por la emergencia (Anexo 8 de los términos de referencia)",
    deptos: ["Antioquia", "Bolívar", "Caldas", "Caquetá", "Cauca", "Chocó", "Cundinamarca", "Huila", "Nariño", "Norte de Santander", "Quindío", "Risaralda", "Santander", "Sucre", "Tolima", "Valle del Cauca"],
    url: "https://minciencias.gov.co/convocatorias/convocatoria-emergencia-para-la-recuperacion-y-generacion-capacidades-transformadoras",
    categorias: { tipo_proyecto: ["Investigación aplicada y CTeI", "Innovación y desarrollo tecnológico"], sector: ["Gestión del riesgo y reconstrucción territorial"], tipo_entidad: ["Institución de educación superior", "Entidad territorial", "MiPyme", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Presentarse como alianza con al menos una IES, una entidad territorial de los departamentos afectados y un actor del SNCTI con reconocimiento vigente, del sector productivo o de la sociedad civil con domicilio en un departamento afectado."],
      ["documento", "Anexo 1: carta unificada de aval, compromiso institucional, participación y modelo de gobernanza."],
      ["documento", "Anexo 2: documento técnico del proyecto, y Anexo 3: presupuesto."],
      ["documento", "Anexo 5: proyectos de CTeI gestionados o ejecutados por el proponente y los integrantes de la alianza, con sus soportes en la plataforma SIGP."],
      ["documento", "Certificado de existencia y representación legal con no más de 90 días de expedido al cierre."],
      ["condicion", "Inscribir el proyecto en el SIGP y presentar el borrador en MGA-WEB (Anexo 15) antes de las 4:00 p. m. del 3 de noviembre de 2026."],
    ],
    documentos: [D("Términos de referencia, convocatoria 56 del SGR", "minciencias56.pdf"), D("Anexo 14: requisitos, reglas de subsanación y condiciones inhabilitantes", "minciencias56_anexo14.pdf", "anexo")],
    oficial: "https://minciencias.gov.co/convocatorias/convocatoria-emergencia-para-la-recuperacion-y-generacion-capacidades-transformadoras",
  },
  {
    fuente: "minciencias",
    nombre: "Convocatoria 53: fortalecimiento de capacidades de CTeI en el departamento de Córdoba (Plan Bienal 2025-2026, corte 2)",
    entidad: "Minciencias, Asignación para la CTeI del Sistema General de Regalías",
    descripcion:
      "Financia un proyecto de CTeI en el departamento de Córdoba, alineado con los retos del Plan Bienal 2025-2026, con $28.094.792.444 del Sistema General de Regalías y hasta 24 meses de ejecución. Se postula una alianza con una IES con domicilio en Córdoba, dos entidades territoriales de Córdoba (una de ellas el Departamento), un actor del sector productivo y una organización de la sociedad civil con domicilio en Córdoba. El proyecto debe abordar al menos dos de las cuatro líneas temáticas y atender una demanda territorial de los retos 1, 2, 5 o 6 del Plan Bienal.",
    apertura: "2026-09-25", cierre: "2026-10-23", montoMin: 28094792444, montoMax: 28094792444,
    ubicacion: "Departamento de Córdoba",
    deptos: ["Córdoba"],
    url: "https://minciencias.gov.co/convocatorias/plan-convocatorias-asctei-2025-2026/convocatoria-para-el-fortalecimiento-capacidades",
    categorias: { tipo_proyecto: ["Investigación aplicada y CTeI", "Innovación y desarrollo tecnológico"], sector: ["Todos los sectores"], tipo_entidad: ["Institución de educación superior", "Entidad territorial", "MiPyme", "Organización social y comunitaria"] },
    requisitos: [
      ["condicion", "Alianza con una IES domiciliada en Córdoba, dos entidades territoriales de Córdoba (una el Departamento), un actor del sector productivo y una organización de la sociedad civil domiciliada en Córdoba."],
      ["condicion", "El proponente o un aliado debe acreditar experiencia como ejecutor en al menos dos proyectos de CTeI finalizados o en curso, terminados en los últimos cinco años (Anexo 5 con soportes en SIGP)."],
      ["condicion", "Al menos un integrante de la alianza debe tener un grupo de investigación categoría A1, A o B registrado en SIGP."],
      ["documento", "Certificado de existencia y representación legal que acredite el domicilio en Córdoba, con no más de 90 días de expedido al cierre."],
      ["condicion", "Abordar al menos dos de las cuatro líneas temáticas y atender una demanda territorial de los retos 1, 2, 5 o 6 del Plan Bienal."],
      ["documento", "Anexo 1 (carta unificada de aval), Anexo 2 (documento técnico) y presupuesto en SIGP, y proyecto en MGA-WEB, antes de las 4:00 p. m. del 23 de octubre de 2026."],
    ],
    documentos: [D("Términos de referencia, convocatoria 53 del SGR", "minciencias53.pdf")],
    oficial: "https://minciencias.gov.co/convocatorias/plan-convocatorias-asctei-2025-2026/convocatoria-para-el-fortalecimiento-capacidades",
  },
  {
    fuente: "gamic",
    nombre: "GAMIC 2026-2027: Global Automotive & Mobility Innovation Challenge (19.ª edición)",
    entidad: "Michigan Innovation Alliance (MIIA) y SAE",
    descripcion:
      "Competencia y acelerador sin ánimo de lucro que conecta tecnologías en etapa temprana de todo el mundo con la industria de la movilidad de Norteamérica: exposición ante fabricantes (OEM), proveedores Tier 1 e inversionistas, mentoría de expertos y oportunidades de pilotos en condiciones reales. Postulación gratuita y sin toma de participación accionaria. Cuartos de final y semifinales entre diciembre de 2026 y enero de 2027, y final en el SAE WCX en Detroit (Michigan, EE. UU.) en abril de 2027. La página de postulación en F6S informa un premio de USD 100.000 en fondos para 4 startups por año.",
    apertura: "2026-09-01", cierre: "2026-11-30", montoMin: null, montoMax: null,
    ubicacion: "Abierta a tecnologías de cualquier país; final en Detroit (EE. UU.)",
    nacional: true,
    url: "https://www.f6s.com/gamic-19th-2026-2027/apply",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Internacionalización y acceso a mercados"], sector: ["Automotriz y movilidad"], tipo_entidad: ["Startup"] },
    requisitos: [
      ["condicion", "Ser una tecnología en etapa temprana, de cualquier país, relacionada con la automoción y la movilidad (los criterios completos están en la página «Competition Overview» de GAMIC)."],
      ["documento", "Formulario de postulación en F6S, completo y finalizado antes del 30 de noviembre de 2026, para la revisión de expertos."],
      ["condicion", "Presentar el pitch en vivo, virtual y presencial, en cuartos de final y semifinales entre diciembre de 2026 y enero de 2027."],
      ["condicion", "Competir en la final en el SAE WCX de Detroit (Michigan, EE. UU.) en abril de 2027."],
    ],
    documentos: [D("Página oficial de GAMIC (copia del 21 de octubre de 2026)", "gamic.pdf", "terminos")],
    oficial: "https://gamicevent.org/",
  },
  {
    fuente: "emerge",
    nombre: "eMerge Americas 2027: Global Startup Accelerator + Showcase",
    entidad: "eMerge Americas",
    descripcion:
      "Acelerador y vitrina global para startups con mentoría uno a uno, serie virtual de formación (recaudación de capital, salida al mercado y crecimiento sostenible), acceso al Founders' Day, un stand en el Expo Showcase y la comunidad de egresados, y la opción de competir en el escenario principal por más de USD 300.000 en inversión y servicios legales en especie. Las startups seleccionadas pagan USD 650 por startup, que cubre a dos integrantes del equipo. Se admiten etapas Pre-Seed, Seed y Serie A en seguridad nacional (aeroespacial, defensa, ciberseguridad, energía), IA y deep tech, salud y finanzas (fintech, blockchain y Web3). La postulación es en línea.",
    apertura: null, cierre: "2026-11-22", montoMin: null, montoMax: null,
    ubicacion: "Startups globales; evento en Miami (EE. UU.)",
    nacional: true,
    url: "https://emergeamericas.skipso.com/en/custom/2027eastartupsubmission/new/submit",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Internacionalización y acceso a mercados"], sector: ["TIC y software", "Salud y ciencias de la vida", "Fintech y Web3"], tipo_entidad: ["Startup"] },
    requisitos: [
      ["condicion", "Cumplir los criterios de una etapa: Pre-Seed (MVP producido, con poco o ningún ingreso), Seed (MVP o producto comercial, al menos dos empleados de tiempo completo y clientes que pagan) o Serie A (producto comercial, ingresos consistentes y equipo directivo)."],
      ["condicion", "Operar en seguridad nacional, IA y tecnologías de frontera, salud o finanzas, con un enfoque innovador a un problema existente."],
      ["documento", "Formulario de postulación en línea, antes del 22 de noviembre de 2026."],
      ["condicion", "Pagar USD 650 por startup seleccionada (cubre a dos integrantes del equipo)."],
    ],
    documentos: [D("Página oficial del acelerador (copia del 21 de octubre de 2026)", "emerge.pdf", "terminos")],
    oficial: "https://emergeamericas.com/startups/startup-showcase-accelerator/",
  },
  {
    fuente: "eulac",
    nombre: "EU-LAC Digital Accelerator: convocatoria abierta n.º 6",
    entidad: "EU-LAC Digital Accelerator (financiado por la Unión Europea)",
    descripcion:
      "Aceleración de alianzas entre una corporación y una startup de dos de estas regiones: Unión Europea, América Latina o Caribe, para resolver un reto de transformación digital (con especial interés en soluciones de IA). Incluye servicios de aceleración valorados hasta en EUR 30.000 (hasta EUR 40.000 con un socio del Caribe), 100 % financiados por la UE y sin costo de ingreso, y apoyos a la startup: hasta EUR 7.000 para una prueba de concepto, EUR 2.000 de viajes y EUR 1.500 de transporte de equipos. El programa dura seis meses y se ofrece en español e inglés. No pueden postularse entidades públicas.",
    apertura: null, cierre: "2026-11-30", montoMin: null, montoMax: null,
    ubicacion: "Alianzas entre la Unión Europea, América Latina y el Caribe",
    nacional: true,
    url: "https://forms.cloud.microsoft/e/PfBJqcxbxL",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Transformación digital", "Innovación y desarrollo tecnológico"], sector: ["TIC y software"], tipo_entidad: ["Startup", "Gran empresa o corporativo", "MiPyme"] },
    requisitos: [
      ["condicion", "Alianza de al menos una corporación y una startup, con socios de dos de las regiones UE, América Latina y Caribe, sobre un reto de transformación digital."],
      ["condicion", "Corporación con más de 50 empleados y ventas superiores a EUR 10 millones (en el Caribe puede ser menor). Startup con 2 a 50 empleados, ventas de EUR 50.000 a EUR 10 millones, clientes y TRL 7 o superior, o una pyme innovadora de menos de 250 empleados."],
      ["condicion", "La solución debe ser propia (se pueden integrar herramientas de terceros, pero no como componente principal) y, por lo general, un producto terminado."],
      ["documento", "Formulario de postulación (plantilla .docx elaborada con el socio) y acuerdo formal de colaboración antes de iniciar la aceleración; existen alianzas previas que pueden postularse."],
      ["condicion", "Comprometerse con los bootcamps, talleres y la colaboración continua durante los seis meses del programa."],
    ],
    documentos: [D("Página oficial de la convocatoria abierta n.º 6 (copia del 21 de octubre de 2026)", "eulac.pdf", "terminos")],
    oficial: "https://eulacdigitalaccelerator.com/open-call/",
  },
  {
    fuente: "unicef",
    nombre: "UNICEF Femtech Ventures: financiación sin cesión de capital para soluciones femtech (segunda cohorte)",
    entidad: "UNICEF Venture Fund",
    descripcion:
      "Financiación sin cesión de capital de hasta USD 100.000, doce meses de mentoría técnica y acceso a la red global de UNICEF y a sus relaciones con gobiernos, para startups con tecnologías de frontera (IA, aprendizaje automático, blockchain o ciencia de datos) que mejoren la salud y el bienestar de mujeres y niñas en tres pilares: acceso a la atención, salud reproductiva, y bienestar mental y seguridad. Se prioriza a empresas con un prototipo funcional, compromiso con el código abierto y registro en un país con programa de UNICEF; se alienta a las lideradas por mujeres o con fundadores menores de 35 años.",
    apertura: null, cierre: "2026-11-04", montoMin: null, montoMax: null,
    ubicacion: "Empresas registradas en un país con programa de UNICEF",
    nacional: true,
    url: "https://form.jotform.com/262722015144346",
    categorias: { tipo_proyecto: ["Financiación no reembolsable y premios", "Innovación y desarrollo tecnológico"], sector: ["Salud y ciencias de la vida"], tipo_entidad: ["Startup"] },
    requisitos: [
      ["condicion", "Empresa registrada en un país con programa de UNICEF (la lista está en la página oficial de la convocatoria; comprobar que el país esté incluido)."],
      ["condicion", "Prototipo funcional y compromiso con las licencias y principios de código abierto."],
      ["condicion", "Solución con tecnologías de frontera (IA, aprendizaje automático, blockchain o ciencia de datos) para la salud, el bienestar y los derechos de mujeres y niñas, bajo uno de los tres pilares."],
      ["condicion", "Cumplir las expectativas de seguridad desde el diseño de UNICEF: privacidad de datos, consentimiento y riesgo para los usuarios."],
      ["documento", "Formulario de postulación en línea, antes del 4 de noviembre de 2026."],
    ],
    documentos: [D("Página oficial de la convocatoria (copia del 21 de octubre de 2026)", "femtech.pdf", "terminos")],
    oficial: "https://www.unicef.org/innovation/FemTechCall",
  },
  {
    fuente: "bnef",
    nombre: "BNEF Pioneers 2027: competencia de innovación climática y energética",
    entidad: "BloombergNEF",
    descripcion:
      "Competencia que reconoce a innovadores con potencial de impacto climático en tres retos para 2027: electricidad limpia rápida, resiliencia de las cadenas de suministro de metales y refrigeración resiliente al clima. Pueden postularse empresas en etapa temprana (privadas, sin ánimo de lucro, públicas o filiales), proyectos piloto y empresas conjuntas, y ONG, laboratorios y comunidades de innovación. Los elegidos obtienen visibilidad en los informes, artículos, videos y eventos de BNEF, un año de acceso a BNEF Web, entrada a sus eventos y conexión con egresados y líderes del sector. No es una convocatoria de financiación.",
    apertura: null, cierre: "2026-11-07", montoMin: null, montoMax: null,
    ubicacion: "Postulantes de cualquier país",
    nacional: true,
    url: "https://about.bnef.com/bnefpioneers/",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Innovación y desarrollo tecnológico"], sector: ["Energía y clima"], tipo_entidad: ["Startup", "ONG o sin ánimo de lucro"] },
    requisitos: [
      ["condicion", "Ser empresa en etapa temprana, proyecto piloto o empresa conjunta, u ONG, laboratorio o comunidad de innovación."],
      ["condicion", "Proponer una solución para uno de los retos de 2027: electricidad limpia rápida, resiliencia de la cadena de suministro de metales o refrigeración resiliente al clima."],
      ["documento", "Formulario de postulación en línea antes del 7 de noviembre de 2026; se evalúan impacto potencial, innovación y probabilidad de adopción."],
    ],
    documentos: [D("Página oficial de BNEF Pioneers (copia del 21 de octubre de 2026)", "bnef.pdf", "terminos")],
    oficial: "https://about.bnef.com/bnefpioneers/",
  },
  {
    fuente: "southsummit",
    nombre: "South Summit Brazil 2027: Startup Competition",
    entidad: "South Summit",
    descripcion:
      "Competencia abierta a startups de cualquier país, sector y etapa. Se seleccionan 50 proyectos que presentan un pitch de tres minutos ante inversionistas y corporaciones en South Summit Brazil, del 14 al 16 de abril de 2027 en Porto Alegre. Los finalistas reciben reuniones uno a uno, entradas para su equipo, mentoría, libro de inversionistas y corporativos, cobertura de medios y descuento en un stand; optan a cinco premios (Ganadora Global, Más Sostenible, Más Escalable, Más Disruptiva y Mejor Equipo). Postular y participar es gratis. El jurado selecciona en enero y anuncia en febrero de 2027.",
    apertura: null, cierre: "2026-12-14", montoMin: null, montoMax: null,
    ubicacion: "Startups de cualquier país; evento en Porto Alegre (Brasil)",
    nacional: true,
    url: "https://www.southsummit.io/e/brazil/content/startup-competition-2027",
    categorias: { tipo_proyecto: ["Aceleración y competencia de startups", "Internacionalización y acceso a mercados"], sector: ["Todos los sectores"], tipo_entidad: ["Startup"] },
    requisitos: [
      ["condicion", "Ser una startup de cualquier país, sector y etapa de desarrollo."],
      ["documento", "Registro gratuito en la plataforma de la convocatoria antes del 14 de diciembre de 2026."],
      ["condicion", "Las 50 finalistas presentan un pitch de tres minutos ante el jurado del 14 al 16 de abril de 2027 en Porto Alegre."],
    ],
    documentos: [D("Página oficial de la convocatoria (copia del 21 de octubre de 2026)", "southcall.pdf", "terminos")],
    oficial: "https://www.southsummit.io/e/brazil/content/startup-competition-2027",
  },
];
