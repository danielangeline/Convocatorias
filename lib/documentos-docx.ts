import "server-only";
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { dividirPorPendientes } from "@/lib/documentos";
import type { DocumentoServidor } from "@/lib/types";

/**
 * RF-60 · Word real (.docx, Office Open XML), armado en el servidor desde el
 * contenido guardado, sin pasar por Storage (docs/04 §8.3). Los pendientes van
 * resaltados en amarillo para que la empresa los complete antes de radicar.
 */

function parrafo(texto: string): Paragraph {
  const lista = /^\s*(-|\d+\.)\s+/.test(texto);
  return new Paragraph({
    spacing: { after: 120 },
    indent: lista ? { left: 360 } : undefined,
    children: dividirPorPendientes(texto).map(
      (parte) =>
        new TextRun({
          text: parte.texto,
          highlight: parte.pendiente ? "yellow" : undefined,
          bold: parte.pendiente || undefined,
        })
    ),
  });
}

export async function documentoAWord(doc: DocumentoServidor): Promise<Buffer> {
  const cuerpo: Paragraph[] = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.titulo)] }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: `${doc.proyectoNombre} → ${doc.convocatoriaNombre} (${doc.entidadConvocante})`, italics: true, color: "555555" }),
      ],
    }),
  ];
  for (const seccion of doc.secciones) {
    cuerpo.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 120 }, children: [new TextRun(seccion.titulo)] }));
    for (const linea of seccion.contenido.split("\n")) {
      if (linea.trim()) cuerpo.push(parrafo(linea));
    }
  }
  cuerpo.push(
    new Paragraph({
      spacing: { before: 360 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Documento base generado con apoyo de IA. Verifícalo y completa los datos resaltados antes de radicarlo en el portal de la entidad convocante.",
          italics: true,
          size: 18,
          color: "777777",
        }),
      ],
    })
  );

  const word = new Document({
    creator: "Plataforma de Gestión de Convocatorias",
    title: doc.titulo,
    styles: { default: { document: { run: { font: "Calibri", size: 24 } } } },
    sections: [{ children: cuerpo }],
  });
  return Packer.toBuffer(word);
}

export function nombreArchivo(titulo: string): string {
  const limpio = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);
  return `${limpio || "documento"}.docx`;
}
