import type { Convocatoria, DocumentoGenerado, Postulacion, Proyecto, SeccionDocumento } from "./types";
import { formatCOP, formatFecha, formatRangoCOP } from "./utils";

const PATRON_COMPLETAR = /\[COMPLETAR:\s*([^\]]+)\]/g;

function marcador(descripcion: string): string {
  return `[COMPLETAR: ${descripcion}]`;
}

export interface ResultadoComposicion {
  secciones: SeccionDocumento[];
  pendientes: string[];
}

/**
 * Compone el documento a partir de los datos REALES del proyecto y la
 * convocatoria. Nunca inventa información: cuando el proyecto no tiene un
 * dato, inserta un marcador [COMPLETAR: ...] visible en su lugar y lo
 * acumula en `pendientes`. Este es el principio de veracidad del módulo de
 * IA — no hay llamada a ningún modelo real, todo se arma con plantillas.
 */
export function componerDocumento(proyecto: Proyecto, convocatoria: Convocatoria): ResultadoComposicion {
  const pendientes: string[] = [];

  const campo = (valor: string | undefined | null, descripcionFaltante: string): string => {
    if (valor && valor.trim()) return valor.trim();
    pendientes.push(descripcionFaltante);
    return marcador(descripcionFaltante);
  };

  const campoNumerico = (valor: number | undefined, formateador: (n: number) => string, descripcionFaltante: string): string => {
    if (valor && valor > 0) return formateador(valor);
    pendientes.push(descripcionFaltante);
    return marcador(descripcionFaltante);
  };

  const objetivosEspecificosTexto = (): string => {
    if (proyecto.objetivosEspecificos && proyecto.objetivosEspecificos.filter((o) => o.trim()).length > 0) {
      return proyecto.objetivosEspecificos
        .filter((o) => o.trim())
        .map((o, i) => `${i + 1}. ${o.trim()}`)
        .join("\n");
    }
    pendientes.push("al menos un objetivo específico del proyecto");
    return marcador("al menos un objetivo específico del proyecto");
  };

  const secciones: SeccionDocumento[] = [
    {
      id: "titulo",
      titulo: "Título",
      contenido: `${proyecto.nombre} — Propuesta para la convocatoria "${convocatoria.nombre}" de ${convocatoria.entidadConvocante}`,
    },
    {
      id: "resumen-ejecutivo",
      titulo: "Resumen ejecutivo",
      contenido:
        `${proyecto.nombre} presenta esta propuesta a la convocatoria "${convocatoria.nombre}", ` +
        `convocada por ${convocatoria.entidadConvocante}. ${campo(proyecto.descripcion, "una descripción general del proyecto")} ` +
        `El proyecto busca una financiación de ${formatCOP(proyecto.montoBuscado)}` +
        // RNF-23: si la entidad no informó el monto, no se menciona ningún rango.
        (convocatoria.montoMin == null && convocatoria.montoMax == null
          ? "."
          : `; el monto que ofrece esta convocatoria es: ${formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax).toLowerCase()}.`),
    },
    {
      id: "problema-justificacion",
      titulo: "Problema y justificación",
      contenido: campo(proyecto.problema, "la descripción del problema que atiende el proyecto y por qué es urgente resolverlo"),
    },
    {
      id: "objetivos",
      titulo: "Objetivos",
      contenido:
        `Objetivo general: ${campo(proyecto.objetivoGeneral, "el objetivo general del proyecto")}\n\n` +
        `Objetivos específicos:\n${objetivosEspecificosTexto()}`,
    },
    {
      id: "poblacion-beneficiaria",
      titulo: "Población beneficiaria",
      contenido: campo(proyecto.poblacionBeneficiaria, "la caracterización de la población o los aliados que se beneficiarán del proyecto"),
    },
    {
      id: "metodologia-actividades",
      titulo: "Metodología y actividades",
      contenido: campo(proyecto.actividades, "las actividades y la metodología que se usarán para ejecutar el proyecto"),
    },
    {
      id: "resultados-esperados",
      titulo: "Resultados esperados",
      contenido: campo(proyecto.resultadosEsperados, "los resultados o impactos esperados del proyecto"),
    },
    {
      id: "presupuesto",
      titulo: "Presupuesto",
      contenido:
        `Monto solicitado a ${convocatoria.entidadConvocante}: ${formatCOP(proyecto.montoBuscado)}.\n` +
        `Presupuesto estimado total del proyecto: ${campoNumerico(proyecto.presupuestoEstimado, formatCOP, "el presupuesto estimado total del proyecto, desglosado por rubros")}.`,
    },
    {
      id: "cronograma",
      titulo: "Cronograma",
      contenido: `Duración estimada de ejecución: ${campoNumerico(proyecto.duracionMeses, (n) => `${n} meses`, "la duración estimada del proyecto en meses")}, contados a partir de la fecha de aprobación de la cofinanciación.`,
    },
    {
      id: "experiencia-organizacion",
      titulo: "Experiencia de la organización",
      contenido: campo(proyecto.experienciaEmpresa, "la experiencia previa de la empresa u organización ejecutora"),
    },
  ];

  return { secciones, pendientes };
}

/** Extrae en vivo los pendientes desde el contenido actual de las secciones. */
export function extraerPendientes(secciones: SeccionDocumento[]): Array<{ seccionId: string; seccionTitulo: string; texto: string }> {
  const resultado: Array<{ seccionId: string; seccionTitulo: string; texto: string }> = [];
  for (const seccion of secciones) {
    const coincidencias = seccion.contenido.matchAll(PATRON_COMPLETAR);
    for (const m of coincidencias) {
      resultado.push({ seccionId: seccion.id, seccionTitulo: seccion.titulo, texto: m[1].trim() });
    }
  }
  return resultado;
}

/** Divide un texto en fragmentos, resaltando los marcadores [COMPLETAR: ...]. */
export function dividirPorPendientes(contenido: string): Array<{ texto: string; pendiente: boolean }> {
  const partes: Array<{ texto: string; pendiente: boolean }> = [];
  let ultimoIndice = 0;
  for (const m of contenido.matchAll(PATRON_COMPLETAR)) {
    const inicio = m.index ?? 0;
    if (inicio > ultimoIndice) partes.push({ texto: contenido.slice(ultimoIndice, inicio), pendiente: false });
    partes.push({ texto: m[0], pendiente: true });
    ultimoIndice = inicio + m[0].length;
  }
  if (ultimoIndice < contenido.length) partes.push({ texto: contenido.slice(ultimoIndice), pendiente: false });
  return partes;
}

/**
 * Simula un ajuste solicitado a la IA modificando visiblemente el texto de
 * las secciones. No hay ningún modelo real detrás: son transformaciones de
 * texto sencillas que reaccionan a palabras clave de la instrucción.
 */
export function aplicarAjusteTexto(secciones: SeccionDocumento[], instruccion: string): SeccionDocumento[] {
  const texto = instruccion.toLowerCase();

  const acortar = (contenido: string): string => {
    const oraciones = contenido.split(/(?<=[.!?])\s+/).filter(Boolean);
    if (oraciones.length <= 1) return contenido;
    const mitad = Math.max(1, Math.ceil(oraciones.length / 2));
    return oraciones.slice(0, mitad).join(" ");
  };

  const conFraseAmbiental = (contenido: string): string =>
    `${contenido}\n\nEste componente también contribuye a la reducción de la huella ambiental del sector y promueve prácticas productivas más sostenibles.`;

  const conTonoTecnico = (contenido: string): string =>
    contenido
      .replace(/\bbuscamos\b/gi, "se plantea como objetivo")
      .replace(/\bhacer\b/gi, "ejecutar")
      .concat("\n\nSe ajustó la redacción a un registro técnico, con terminología propia del sector.");

  const conNotaGenerica = (contenido: string): string =>
    `${contenido}\n\n(Ajuste aplicado según tu indicación: "${instruccion.trim()}".)`;

  return secciones.map((seccion) => {
    if (seccion.id === "titulo") return seccion; // el título no se ajusta con IA
    let contenido = seccion.contenido;

    if (texto.includes("breve") || texto.includes("corto") || texto.includes("resumido")) {
      contenido = acortar(contenido);
    } else if (texto.includes("ambiental") || texto.includes("impacto ambiental") || texto.includes("sostenib")) {
      contenido = conFraseAmbiental(contenido);
    } else if (texto.includes("técnico") || texto.includes("tecnico") || texto.includes("formal")) {
      contenido = conTonoTecnico(contenido);
    } else {
      contenido = conNotaGenerica(contenido);
    }

    return { ...seccion, contenido };
  });
}

function escapeHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resaltarPendientesHtml(textoEscapado: string): string {
  return textoEscapado.replace(
    /\[COMPLETAR:\s*([^\]]+)\]/g,
    '<span style="background:#fde68a;padding:0 4px;border-radius:3px;">[COMPLETAR: $1]</span>'
  );
}

function slugify(texto: string): string {
  const sinAcentos = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
  const limpio = sinAcentos.replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "").slice(0, 60);
  return limpio || "documento";
}

/** Genera un .doc (HTML disfrazado, sin librerías externas) y dispara la descarga. */
export function exportarDocumentoWord(documento: DocumentoGenerado): void {
  const cuerpo = documento.secciones
    .map((s) => {
      const parrafos = escapeHtml(s.contenido)
        .split("\n")
        .filter((p) => p.trim().length > 0)
        .map((p) => `<p>${resaltarPendientesHtml(p)}</p>`)
        .join("\n");
      return `<h2>${escapeHtml(s.titulo)}</h2>\n${parrafos}`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${escapeHtml(documento.titulo)}</title></head>
<body style="font-family: Calibri, sans-serif; font-size: 12pt;">
<h1>${escapeHtml(documento.titulo)}</h1>
${cuerpo}
</body>
</html>`;

  const blob = new Blob(["﻿", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = `${slugify(documento.titulo)}.doc`;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  URL.revokeObjectURL(url);
}

export const EJEMPLOS_AJUSTE = ["hazlo más breve", "enfatiza el impacto ambiental", "usa un tono más técnico"];

export const ESTADO_DOCUMENTO_LABEL: Record<string, string> = {
  generado: "Generado",
  editado: "Editado",
  exportado: "Exportado",
};

export const ESTADO_DOCUMENTO_ESTILO: Record<string, string> = {
  generado: "bg-teal-50 text-teal-700 ring-teal-200",
  editado: "bg-amber-50 text-amber-700 ring-amber-200",
  exportado: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function postulacionParaProyectoConv(
  proyectoId: string,
  convocatoriaId: string,
  postulaciones: Postulacion[]
): Postulacion | undefined {
  return postulaciones.find((p) => p.proyectoId === proyectoId && p.convocatoriaId === convocatoriaId);
}

export function documentoParaProyectoConv(
  proyectoId: string,
  convocatoriaId: string,
  documentos: DocumentoGenerado[]
): DocumentoGenerado | undefined {
  return documentos
    .filter((d) => d.proyectoId === proyectoId && d.convocatoriaId === convocatoriaId)
    .sort((a, b) => (a.fechaActualizacion < b.fechaActualizacion ? 1 : -1))[0];
}

export function formatFechaCorta(iso: string): string {
  return formatFecha(iso);
}
