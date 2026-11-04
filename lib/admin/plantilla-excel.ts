import "server-only";
import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";
import { DEPARTAMENTOS } from "@/lib/departamentos";
import { COLUMNAS_CARGA, MARCA_OPCIONAL, MAXIMO_FILAS } from "./carga-masiva";

/**
 * CU-50 2a, RF-118 (sesión 039) · Plantilla de la carga masiva en Excel, para
 * que la llene una persona o un agente de IA que busca convocatorias. Se arma
 * en cada descarga: las listas válidas (fuentes y categorías activas, países)
 * se leen con la sesión del administrador, así que nunca quedan viejas.
 *
 * La hoja «Convocatorias» lleva en la fila 1 los encabezados de
 * `COLUMNAS_CARGA`, en su orden: guardada como CSV UTF-8 es exactamente lo que
 * lee `leerCsv`. Lo que el prompt exige de más (TDR, países, enlace) es una
 * regla para el agente; el servidor sigue validando solo RF-118.
 */

const AZUL = "FF1F3864";
const VERDE = "FF0F766E";
const ROJO = "FF8A2A21";
const FILAS_CON_FORMATO = MAXIMO_FILAS + 1;

/** Columnas que el agente no puede dejar vacías aunque la plataforma las acepte así. */
const EXIGIDAS_AL_AGENTE = new Set(["paises", "cobertura_nacional", "url_postulacion"]);
/** La columna puede faltar (el TDR se puede arrastrar), pero la plataforma rechaza la fila sin TDR (CU-50 4e). */
const exigeLaPlataforma = (c: { clave: string; obligatoria: boolean }) => c.obligatoria || c.clave === "documentos";

/** Indicación de cada columna en el prompt; sin entrada, se usa la guía de la plantilla. */
const INDICACIONES: Record<string, string> = {
  fuente: "EXACTAMENTE una de «Fuentes registradas» (hoja Listas válidas). Si la entidad no está, escribe su nombre oficial corto: el administrador la registra al subir el archivo.",
  nombre: "nombre oficial de la convocatoria, máximo 300 caracteres. No lo traduzcas.",
  entidad_convocante: "entidad que la abre, máximo 200 caracteres.",
  descripcion: "objeto y alcance en 2 a 5 frases, fieles a la fuente (puede ir en español).",
  tipo: "«fondo» o «beneficio_tributario». Si no es un beneficio tributario, «fondo».",
  origen: "«publico» (entidad del Estado), «privado» (empresa o fundación privada) o «cooperacion» (organismo internacional, otro gobierno o banco multilateral). Sin tildes.",
  moneda: "código ISO de 3 letras de la moneda en que la fuente publica el monto (COP, USD, EUR, GBP…).",
  monto_minimo: "número entero, sin símbolo ni decimales (50000000 o 50.000.000). Vacío si la fuente no lo da.",
  monto_maximo: "igual; no menor que el mínimo. Si la fuente da un único monto («hasta X»), va aquí y el mínimo queda vacío.",
  paises: "TODOS si cualquier país puede postularse; si no, códigos ISO de 2 letras separados por | (CO o CO|MX|PE).",
  cobertura_nacional: "«si» si dentro de Colombia aplica a todo el país; «no» si solo a ciertos departamentos. Para convocatorias internacionales, «si».",
  departamentos: "solo si cobertura_nacional es «no»: códigos DANE separados por | (05|11). Si es «si», vacía.",
  ubicacion_detalle: "la cobertura en texto libre («Todo el país», «Municipios PDET de Cauca y Nariño», «América Latina y el Caribe»).",
  fecha_apertura: "AAAA-MM-DD. Vacía si no se publica.",
  fecha_cierre: "AAAA-MM-DD. Si hay varios cortes, el próximo; los demás, en la descripción.",
  url_postulacion: "enlace oficial (https://) a la página de la convocatoria o al formulario de postulación.",
  categorias: "entre 1 y 5 nombres copiados EXACTAMENTE de «Categorías» (hoja Listas válidas), separados por |: un sector, un tipo de entidad y un tipo de proyecto cuando aplique. No inventes categorías.",
  requisitos_documentos: `documentos que pide el TDR, separados por |. Si uno no es obligatorio, empiézalo con ${MARCA_OPCIONAL} («Certificado de existencia y representación legal|RUT|${MARCA_OPCIONAL} Carta de apoyo de un aliado»).`,
  requisitos_condiciones: `condiciones de elegibilidad del TDR, separadas por |, una por condición, con ${MARCA_OPCIONAL} igual que arriba.`,
  documentos: "enlaces DIRECTOS a los archivos oficiales, separados por |, cada uno seguido de = y su tipo: TDR, terminos, anexo o formato. Al menos uno =TDR. Ejemplo: https://www.entidad.gov.co/tdr-2027.pdf=TDR|https://www.entidad.gov.co/anexo-1.docx=anexo",
};


function textoPrompt(hoy: string): string[] {
  const columnas = COLUMNAS_CARGA.map((c, i) => {
    const marca = exigeLaPlataforma(c) || EXIGIDAS_AL_AGENTE.has(c.clave) ? " (OBLIGATORIA)" : "";
    return `${i + 1}. ${c.clave}${marca}: ${INDICACIONES[c.clave] ?? c.guia}`;
  });
  return [
    "ROL",
    "Eres un investigador de convocatorias de financiación. Tu trabajo es encontrar convocatorias ABIERTAS a las que puedan postularse empresas, emprendimientos u organizaciones (con prioridad para Colombia) y entregarlas en la hoja «Convocatorias» de este Excel, una convocatoria por fila, exactamente con las columnas y reglas de abajo. Ese archivo se sube tal cual a la plataforma: si una celda no cumple la regla, la fila se rechaza.",
    "",
    "QUÉ BUSCAR",
    `- Convocatorias con fecha de cierre POSTERIOR a hoy (fecha de hoy: ${hoy}).`,
    "- Solo de fuentes oficiales: el sitio de la entidad que la abre, su portal de convocatorias o su API pública. No uses agregadores, blogs, noticias ni redes sociales como fuente de los datos; puedes usarlos solo para descubrir una convocatoria y luego confirmarla en el sitio oficial.",
    "- Tema / alcance de esta búsqueda: [ESCRIBE AQUÍ EL TEMA, SECTOR O PAÍS].",
    `- Máximo ${MAXIMO_FILAS} filas por archivo.`,
    "",
    "REGLA DE ORO: NO INVENTES NADA",
    "- Cada dato debe salir de la página oficial o de los términos de referencia (TDR). Si un dato no aparece, deja la celda VACÍA. Nunca lo estimes, lo deduzcas ni lo completes «por lógica».",
    "- Montos: en la moneda en que los publica la fuente. NO conviertas a pesos ni redondees.",
    "- No traduzcas los nombres oficiales de la convocatoria ni de la entidad.",
    "",
    "CONDICIÓN PARA INCLUIR UNA FILA (si falta cualquiera, NO la pongas en la hoja: anótala en tu informe de descartadas)",
    "1. Tiene fecha de cierre explícita y futura.",
    "2. Tiene al menos UN documento de términos de referencia con ENLACE DIRECTO al archivo (PDF, Word, Excel o ZIP, de hasta 20 MB), en la columna «documentos» con «=TDR». Un enlace a una página web que «contiene» el TDR no sirve: debe ser el enlace que descarga el archivo.",
    "3. Sabes qué países pueden postularse.",
    "4. Tiene enlace oficial de la convocatoria o de postulación.",
    "",
    "COLUMNAS (en este orden exacto; no agregues, quites ni renombres columnas; la fila 1 son los encabezados y no se toca)",
    ...columnas,
    "",
    "FORMATO DE LAS CELDAS",
    "- Texto plano. Sin saltos de línea dentro de una celda. No uses punto y coma (;) dentro de ninguna celda: usa comas.",
    "- Varios valores dentro de una celda: separados por | (barra vertical), sin espacios alrededor.",
    "- Fechas siempre AAAA-MM-DD.",
    "- Sin filas de ejemplo ni filas vacías intermedias. Sin repetir una convocatoria (mismo nombre y misma entidad).",
    "",
    "ANTES DE ENTREGAR, REVISA CADA FILA",
    "[ ] fuente, nombre, entidad_convocante y fecha_cierre llenos; fecha_cierre futura.",
    "[ ] documentos tiene al menos un enlace directo =TDR, y abriste el enlace para confirmar que descarga el archivo.",
    "[ ] paises lleno; cobertura_nacional es si o no, y departamentos solo si es no.",
    "[ ] categorías copiadas exactas de la lista; montos en la moneda original; ningún dato inventado.",
    "",
    "QUÉ ENTREGAS",
    "1. Este Excel con la hoja «Convocatorias» llena (o, si no puedes editar Excel, un CSV en UTF-8 con separador punto y coma, con los mismos encabezados en la primera línea y en el mismo orden).",
    "2. Un informe corto aparte: las convocatorias descartadas y por qué, y las fuentes que usaste que no estaban en la lista.",
  ];
}

const TITULOS_PROMPT = ["ROL", "QUÉ BUSCAR", "REGLA DE ORO", "CONDICIÓN PARA", "COLUMNAS", "FORMATO DE", "ANTES DE ENTREGAR", "QUÉ ENTREGAS"];
const GRUPOS: Record<string, string> = { sector: "Sector", tipo_entidad: "Tipo de entidad", tipo_proyecto: "Tipo de proyecto" };

function encabezado(celda: ExcelJS.Cell, color = AZUL) {
  celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
  celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  celda.alignment = { vertical: "middle" };
}

export async function plantillaExcel(): Promise<Buffer> {
  const supabase = await crearClienteServidor();
  const [fuentes, categorias, paises] = await Promise.all([
    supabase.from("fuentes").select("nombre").eq("activa", true).order("nombre"),
    supabase.from("categorias").select("nombre, tipo").eq("activa", true).order("tipo").order("nombre"),
    supabase.from("paises").select("codigo, nombre").order("nombre"),
  ]);
  for (const r of [fuentes, categorias, paises]) {
    if (r.error) throw new Error(`Plantilla Excel: no se pudieron leer las listas: ${r.error.message}`);
  }

  const libro = new ExcelJS.Workbook();

  // 1. Hoja de carga: se guarda como CSV y se sube tal cual.
  const hoja = libro.addWorksheet("Convocatorias", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
  COLUMNAS_CARGA.forEach((c, i) => {
    const columna = hoja.getColumn(i + 1);
    columna.width = Math.min(50, Math.max(14, c.ejemplo.length * 0.6, c.clave.length + 4));
    // Texto: Excel no convierte las fechas ni quita el cero de «05».
    for (let fila = 2; fila <= FILAS_CON_FORMATO; fila++) hoja.getCell(fila, i + 1).numFmt = "@";
    const celda = hoja.getCell(1, i + 1);
    celda.value = c.clave;
    const color = exigeLaPlataforma(c) ? ROJO : EXIGIDAS_AL_AGENTE.has(c.clave) ? VERDE : AZUL;
    encabezado(celda, color);
    const etiqueta = exigeLaPlataforma(c) ? "OBLIGATORIA (la plataforma la exige)" : EXIGIDAS_AL_AGENTE.has(c.clave) ? "OBLIGATORIA para el agente" : "Opcional";
    celda.note = `${etiqueta}\n${INDICACIONES[c.clave] ?? c.guia}`;
  });
  hoja.getRow(1).height = 24;
  const desplegable = (clave: string, valores: string[]) => {
    const columna = COLUMNAS_CARGA.findIndex((c) => c.clave === clave) + 1;
    for (let fila = 2; fila <= FILAS_CON_FORMATO; fila++) {
      hoja.getCell(fila, columna).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${valores.join(",")}"`],
        showErrorMessage: true,
        errorTitle: "Valor no válido",
        error: "Elige un valor de la lista.",
      };
    }
  };
  desplegable("tipo", ["fondo", "beneficio_tributario"]);
  desplegable("origen", ["publico", "privado", "cooperacion"]);
  desplegable("cobertura_nacional", ["si", "no"]);

  // 2. Prompt para el agente.
  const prompt = libro.addWorksheet("Prompt para el agente");
  prompt.getColumn(1).width = 130;
  prompt.getCell("A1").value = "PROMPT PARA EL AGENTE DE IA QUE BUSCA CONVOCATORIAS";
  encabezado(prompt.getCell("A1"));
  prompt.getCell("A1").font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  prompt.getCell("A2").value = "Copia el texto desde la fila 4 y pégalo al agente junto con este Excel. Completa lo que está [entre corchetes].";
  prompt.getCell("A2").font = { italic: true, color: { argb: "FF555555" } };
  textoPrompt(hoyColombia()).forEach((linea, i) => {
    const celda = prompt.getCell(i + 4, 1);
    celda.value = linea;
    celda.alignment = { wrapText: true, vertical: "top" };
    if (TITULOS_PROMPT.some((t) => linea.startsWith(t))) celda.font = { bold: true, size: 12, color: { argb: AZUL } };
  });

  // 3. Guía de columnas.
  const guia = libro.addWorksheet("Guía de columnas");
  guia.columns = [{ width: 5 }, { width: 24 }, { width: 28 }, { width: 70 }, { width: 60 }];
  guia.addRow(["#", "Columna", "¿Obligatoria?", "Regla", "Ejemplo"]).eachCell((c) => encabezado(c));
  COLUMNAS_CARGA.forEach((c, i) => {
    const etiqueta = exigeLaPlataforma(c) ? "Sí (la plataforma la exige)" : EXIGIDAS_AL_AGENTE.has(c.clave) ? "Sí (regla para el agente)" : "No";
    const fila = guia.addRow([i + 1, c.clave, etiqueta, INDICACIONES[c.clave] ?? c.guia, c.ejemplo]);
    fila.alignment = { wrapText: true, vertical: "top" };
  });
  guia.addRow([]);
  for (const nota of [
    "Colores de los encabezados: rojo = la plataforma rechaza la fila si falta; verde = regla para el agente; azul = opcional.",
    `Máximo ${MAXIMO_FILAS} filas por archivo. Todo lo cargado queda en BORRADOR hasta que un administrador lo publica.`,
    "Para subir: con la hoja «Convocatorias» activa, Archivo → Guardar como → «CSV UTF-8», y súbelo en Panel → Convocatorias → Carga masiva.",
  ]) {
    guia.addRow(["", `• ${nota}`]);
  }

  // 4. Listas válidas, leídas en esta descarga.
  const listas = libro.addWorksheet("Listas válidas", { views: [{ state: "frozen", ySplit: 2 }] });
  const bloque = (columna: number, titulo: string, nombres: string[], filas: string[][]) => {
    listas.getCell(1, columna).value = titulo;
    encabezado(listas.getCell(1, columna));
    if (nombres.length > 1) listas.mergeCells(1, columna, 1, columna + nombres.length - 1);
    nombres.forEach((n, j) => {
      listas.getCell(2, columna + j).value = n;
      listas.getCell(2, columna + j).font = { bold: true };
    });
    filas.forEach((f, i) => f.forEach((v, j) => {
      const celda = listas.getCell(i + 3, columna + j);
      celda.numFmt = "@";
      celda.value = v;
    }));
  };
  bloque(1, "Fuentes registradas", ["fuente"], (fuentes.data ?? []).map((f) => [f.nombre]));
  bloque(3, "Categorías (copiar exacto)", ["categoría", "grupo"], (categorias.data ?? []).map((c) => [c.nombre, GRUPOS[c.tipo] ?? c.tipo]));
  bloque(6, "Departamentos (DANE)", ["código", "departamento"], [...DEPARTAMENTOS].sort((a, b) => a.codigo.localeCompare(b.codigo)).map((d) => [d.codigo, d.nombre]));
  bloque(9, "Tipos de documento", ["tipo", "uso"], [
    ["TDR", "Términos de referencia (al menos uno por fila)"],
    ["terminos", "Términos y condiciones o bases"],
    ["anexo", "Anexos"],
    ["formato", "Formatos a diligenciar"],
  ]);
  bloque(12, "Países (ISO)", ["código", "país"], (paises.data ?? []).map((p) => [p.codigo, p.nombre]));
  [55, 3, 45, 18, 3, 9, 44, 3, 12, 44, 3, 9, 35].forEach((ancho, i) => (listas.getColumn(i + 1).width = ancho));

  return Buffer.from(await libro.xlsx.writeBuffer());
}
