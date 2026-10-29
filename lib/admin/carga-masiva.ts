/**
 * Carga masiva de convocatorias desde un CSV (CU-50, RF-118).
 *
 * Aquí vive lo que comparten la pantalla y el servidor: las columnas de la
 * plantilla con su guía, la plantilla misma y el lector del CSV. Quien decide
 * qué se crea es el servidor (`carga-masiva-servidor.ts`, RNF-20); la pantalla
 * solo descarga la plantilla y muestra la guía.
 */

import type { TipoDocumento } from "@/lib/types";

export const MAXIMO_FILAS = 200;
export const MAXIMO_CARACTERES = 2_000_000;
/** Separador de listas dentro de una celda (países, departamentos, categorías, requisitos). */
export const SEPARADOR_LISTA = "|";
export const MARCA_OPCIONAL = "[opcional]";

export type ColumnaCarga = {
  clave: string;
  obligatoria: boolean;
  guia: string;
  ejemplo: string;
};

export const COLUMNAS_CARGA: ReadonlyArray<ColumnaCarga> = [
  { clave: "fuente", obligatoria: true, guia: "Nombre de una fuente activa, como está en Fuentes.", ejemplo: "MinCiencias" },
  { clave: "nombre", obligatoria: true, guia: "Nombre de la convocatoria (hasta 300 caracteres).", ejemplo: "Convocatoria de ejemplo para innovación empresarial 2027" },
  { clave: "entidad_convocante", obligatoria: true, guia: "Quién la abre (hasta 200 caracteres).", ejemplo: "Ministerio de Ciencia, Tecnología e Innovación" },
  { clave: "descripcion", obligatoria: false, guia: "Objeto y alcance, tal como lo dice la fuente.", ejemplo: "Financia proyectos de innovación de empresas colombianas." },
  { clave: "tipo", obligatoria: false, guia: "fondo o beneficio_tributario. Vacío: fondo.", ejemplo: "fondo" },
  { clave: "origen", obligatoria: false, guia: "publico, privado o cooperacion. Vacío: publico.", ejemplo: "publico" },
  { clave: "moneda", obligatoria: false, guia: "Código ISO de 3 letras (COP, USD, EUR…). Vacío: COP.", ejemplo: "COP" },
  { clave: "monto_minimo", obligatoria: false, guia: "Entero en esa moneda, con puntos de miles o sin ellos. Sin centavos.", ejemplo: "" },
  { clave: "monto_maximo", obligatoria: false, guia: "Igual que el mínimo; no puede ser menor que él.", ejemplo: "500.000.000" },
  { clave: "paises", obligatoria: false, guia: "TODOS, o códigos ISO (CO, MX…) o nombres separados por |.", ejemplo: "CO" },
  { clave: "cobertura_nacional", obligatoria: false, guia: "si o no. Si es si, no lleva departamentos.", ejemplo: "si" },
  { clave: "departamentos", obligatoria: false, guia: "Códigos DANE (05, 11…) o nombres separados por |.", ejemplo: "" },
  { clave: "ubicacion_detalle", obligatoria: false, guia: "Detalle de la cobertura en texto libre.", ejemplo: "Todo el país" },
  { clave: "fecha_apertura", obligatoria: false, guia: "AAAA-MM-DD o DD/MM/AAAA.", ejemplo: "2026-11-01" },
  { clave: "fecha_cierre", obligatoria: true, guia: "AAAA-MM-DD o DD/MM/AAAA. No puede haber pasado.", ejemplo: "2026-12-15" },
  { clave: "url_postulacion", obligatoria: false, guia: "Enlace oficial que empiece por http:// o https://.", ejemplo: "https://minciencias.gov.co/convocatorias" },
  { clave: "categorias", obligatoria: false, guia: "Nombres de categorías activas separados por |.", ejemplo: "Innovación y desarrollo tecnológico|MiPyme" },
  { clave: "requisitos_documentos", obligatoria: false, guia: `Documentos que se piden, separados por |. Los que empiezan por ${MARCA_OPCIONAL} no son obligatorios.`, ejemplo: `Certificado de existencia y representación legal|${MARCA_OPCIONAL} Carta de apoyo de un aliado` },
  { clave: "requisitos_condiciones", obligatoria: false, guia: "Condiciones que se piden, separadas por |. Igual que los documentos.", ejemplo: "Ser empresa constituida en Colombia con al menos un año de existencia" },
  { clave: "documentos", obligatoria: false, guia: "Enlaces oficiales de los documentos (los descarga el sistema) o nombres de archivos que eliges junto con el CSV, separados por |, cada uno con su tipo tras = (TDR, terminos, anexo o formato; sin tipo, TDR). PDF, Word, Excel o ZIP de hasta 20 MB. También puedes arrastrarlos a cada convocatoria en la vista previa.", ejemplo: "https://www.ejemplo.gov.co/tdr-convocatoria.pdf=TDR|anexo-1-carta.docx=anexo" },
];

/** Sin tildes, sin mayúsculas y con los espacios colapsados: así se comparan nombres. */
export function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Celda de CSV: entre comillas si lleva separador, comillas o saltos de línea. */
function celda(valor: string, separador: string): string {
  return /["\r\n]/.test(valor) || valor.includes(separador) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/**
 * Plantilla con encabezados y una fila de ejemplo. Punto y coma y BOM de UTF-8:
 * así Excel en español la abre en columnas y con las tildes bien.
 */
export function plantillaCsv(): string {
  const encabezados = COLUMNAS_CARGA.map((c) => c.clave).join(";");
  const ejemplo = COLUMNAS_CARGA.map((c) => celda(c.ejemplo, ";")).join(";");
  return `﻿${encabezados}\r\n${ejemplo}\r\n`;
}

export type CsvLeido =
  | { ok: true; encabezados: string[]; filas: Array<{ numero: number; celdas: Record<string, string> }> }
  | { ok: false; error: string };

/** Separador de la primera línea: el que más aparece fuera de comillas entre ; , y tabulador. */
function detectarSeparador(primeraLinea: string): string {
  const cuenta: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  let entreComillas = false;
  for (const ch of primeraLinea) {
    if (ch === '"') entreComillas = !entreComillas;
    else if (!entreComillas && ch in cuenta) cuenta[ch]++;
  }
  return Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0];
}

/** RFC 4180: comillas dobles, comillas escapadas y saltos de línea dentro de una celda. */
function partir(texto: string, separador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let actual = "";
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const ch = texto[i];
    if (entreComillas) {
      if (ch === '"') {
        if (texto[i + 1] === '"') {
          actual += '"';
          i++;
        } else entreComillas = false;
      } else actual += ch;
    } else if (ch === '"') entreComillas = true;
    else if (ch === separador) {
      fila.push(actual);
      actual = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && texto[i + 1] === "\n") i++;
      fila.push(actual);
      filas.push(fila);
      fila = [];
      actual = "";
    } else actual += ch;
  }
  if (actual !== "" || fila.length > 0) {
    fila.push(actual);
    filas.push(fila);
  }
  return filas;
}

/**
 * Lee el CSV y lo devuelve por columna. Exige las columnas obligatorias; las
 * desconocidas se rechazan para no perder un dato por un encabezado mal escrito.
 * Las filas vacías se saltan; `numero` es la fila tal como la ve Excel (la 1 es
 * el encabezado).
 */
export function leerCsv(texto: string): CsvLeido {
  if (texto.length > MAXIMO_CARACTERES) return { ok: false, error: "El archivo es demasiado grande (máximo 2 MB)." };
  const limpio = texto.replace(/^﻿/, "");
  if (!limpio.trim()) return { ok: false, error: "El archivo está vacío." };

  const primeraLinea = limpio.slice(0, limpio.search(/\r?\n|$/));
  const crudas = partir(limpio, detectarSeparador(primeraLinea));
  const encabezados = crudas[0].map((e) => normalizar(e).replace(/ /g, "_"));

  const conocidas = new Set(COLUMNAS_CARGA.map((c) => c.clave));
  const desconocidas = encabezados.filter((e) => e && !conocidas.has(e));
  if (desconocidas.length > 0) {
    return { ok: false, error: `Columnas que no reconocemos: ${desconocidas.join(", ")}. Usa los encabezados de la plantilla.` };
  }
  const repetidas = encabezados.filter((e, i) => e && encabezados.indexOf(e) !== i);
  if (repetidas.length > 0) return { ok: false, error: `Columnas repetidas: ${[...new Set(repetidas)].join(", ")}.` };
  const faltan = COLUMNAS_CARGA.filter((c) => c.obligatoria && !encabezados.includes(c.clave)).map((c) => c.clave);
  if (faltan.length > 0) return { ok: false, error: `Faltan columnas obligatorias: ${faltan.join(", ")}.` };

  const filas: Array<{ numero: number; celdas: Record<string, string> }> = [];
  crudas.slice(1).forEach((valores, i) => {
    if (valores.every((v) => v.trim() === "")) return;
    const celdas: Record<string, string> = {};
    encabezados.forEach((e, j) => {
      if (e) celdas[e] = (valores[j] ?? "").trim();
    });
    filas.push({ numero: i + 2, celdas });
  });
  if (filas.length === 0) return { ok: false, error: "El archivo no tiene filas debajo del encabezado." };
  if (filas.length > MAXIMO_FILAS) {
    return { ok: false, error: `El archivo tiene ${filas.length} filas; el máximo es ${MAXIMO_FILAS}. Pártelo en varios.` };
  }
  return { ok: true, encabezados, filas };
}

/** Celda con varios valores separados por `|`, sin vacíos. */
export function lista(valor: string | undefined): string[] {
  return (valor ?? "")
    .split(SEPARADOR_LISTA)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** AAAA-MM-DD, o DD/MM/AAAA y DD-MM-AAAA (como suele guardarla Excel). Devuelve AAAA-MM-DD o null. */
export function leerFecha(valor: string): string | null {
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(valor);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(valor);
  const partes = iso ? [iso[1], iso[2], iso[3]] : local ? [local[3], local[2], local[1]] : null;
  if (!partes) return null;
  const [a, m, d] = partes;
  const fecha = `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const comprobada = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(comprobada.getTime()) && comprobada.toISOString().slice(0, 10) === fecha ? fecha : null;
}

/**
 * Documento de una fila: un archivo elegido junto al CSV (`archivo`, su nombre
 * exacto) o un enlace que descarga el servidor (`enlace`, RNF-37).
 */
export type DocumentoCarga = { tipo: TipoDocumento } & ({ archivo: string; enlace?: undefined } | { enlace: string; archivo?: undefined });

/** Lo que la pantalla dice de cada archivo elegido; el archivo mismo no viaja al servidor. */
export type ArchivoElegido = { nombre: string; tamanoBytes: number };

/** Resultado de una fila, en la vista previa y al crear. */
export type FilaCarga = {
  numero: number;
  nombre: string;
  estado: "valida" | "error" | "duplicada" | "creada" | "fallo";
  errores: string[];
  documentos: DocumentoCarga[];
  id?: string;
};

export type ResultadoCarga = {
  confirmado: boolean;
  filas: FilaCarga[];
  validas: number;
  creadas: number;
  /** Archivos elegidos que ninguna fila nombra: no se suben (CU-50 4c). */
  archivosSinUsar: string[];
  /** Fuentes que el archivo nombra y no existen, con las filas que las usan (CU-50 4d). */
  fuentesNuevas: Array<{ nombre: string; filas: number[] }>;
  /** Fuentes que existen pero están inactivas: se activan en Fuentes (CU-50 4d). */
  fuentesInactivas: Array<{ nombre: string; filas: number[] }>;
};

const TIPOS_DOCUMENTO: Record<string, TipoDocumento> = {
  tdr: "TDR",
  terminos: "terminos",
  anexo: "anexo",
  formato: "formato",
};

const esEnlace = (valor: string) => /^https?:\/\//i.test(valor);

/**
 * Celda `documentos`: `archivo.pdf=TDR|https://…/tdr.pdf|otro.docx=anexo`.
 * Cada parte es un archivo elegido o un enlace, con su tipo tras el último `=`
 * (sin tipo, TDR). En un enlace, lo que sigue al último `=` solo es el tipo si
 * es uno de los cuatro: un enlace con `?id=123` es todo enlace. Devuelve los
 * errores de forma; si el archivo se eligió, o si el enlace es válido, lo
 * comprueba quien llama. `nombrados` son todos los archivos que la celda
 * menciona, aunque su tipo esté mal escrito.
 */
export function leerDocumentos(valor: string | undefined): {
  documentos: DocumentoCarga[];
  nombrados: string[];
  errores: string[];
} {
  const documentos: DocumentoCarga[] = [];
  const nombrados: string[] = [];
  const errores: string[] = [];
  for (const parte of lista(valor)) {
    const igual = parte.lastIndexOf("=");
    const sufijo = igual === -1 ? "" : parte.slice(igual + 1).trim();
    const conTipo = igual !== -1 && (!esEnlace(parte) || normalizar(sufijo) in TIPOS_DOCUMENTO);
    const valorDoc = (conTipo ? parte.slice(0, igual) : parte).trim();
    const tipoTexto = conTipo ? sufijo : "TDR";
    const tipo = TIPOS_DOCUMENTO[normalizar(tipoTexto)];
    if (!valorDoc) errores.push(`documentos: «${parte}» no dice el archivo ni el enlace.`);
    else if (esEnlace(valorDoc)) {
      if (!tipo) errores.push(`documentos: el tipo «${tipoTexto}» de ${valorDoc} no es TDR, terminos, anexo ni formato.`);
      else documentos.push({ enlace: valorDoc, tipo });
    } else {
      nombrados.push(valorDoc);
      if (!tipo) errores.push(`documentos: el tipo «${tipoTexto}» de ${valorDoc} no es TDR, terminos, anexo ni formato.`);
      else documentos.push({ archivo: valorDoc, tipo });
    }
  }
  return { documentos, nombrados, errores };
}
