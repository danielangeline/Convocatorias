import "server-only";
import { crearClienteServicio } from "@/lib/supabase/servidor";
import { sanearTextoTercero, type AdjuntoSaneado } from "./contexto";

/**
 * RF-55 · Texto de los términos de referencia de la convocatoria, saneado
 * (RN-23, RNF-31) y dentro del tope de la plantilla (RNF-24). Se leen el TDR y
 * los términos: los anexos y formatos son plantillas para diligenciar, no
 * contexto. Solo PDF y Word moderno (.docx); el resto se omite sin fallar.
 *
 * Se leen con service_role porque quien genera ya pasó por la vigencia y la
 * propiedad del proyecto en `iniciar_generacion`, y el bucket es privado.
 */

const BUCKET = "documentos-convocatorias";
const TIPOS = ["TDR", "terminos"];

async function textoDe(ruta: string, datos: ArrayBuffer): Promise<string | null> {
  const ext = ruta.slice(ruta.lastIndexOf(".") + 1).toLowerCase();
  if (ext === "pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(datos));
    const { text } = await extractText(pdf, { mergePages: true });
    return text;
  }
  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(datos) });
    return value;
  }
  return null;
}

export interface ResultadoAdjuntos {
  adjuntos: AdjuntoSaneado[];
  neutralizadas: number;
  recortado: boolean;
  omitidos: string[];
}

export async function textoDeAdjuntos(convocatoriaId: string, tope: number): Promise<ResultadoAdjuntos> {
  const supabase = crearClienteServicio();
  const { data, error } = await supabase
    .from("documentos_convocatoria")
    .select("nombre, tipo_doc, storage_path")
    .eq("convocatoria_id", convocatoriaId)
    .in("tipo_doc", TIPOS)
    .order("tipo_doc", { ascending: true });
  if (error) {
    console.error("IA: no se pudieron listar los adjuntos", error.code, error.message);
    return { adjuntos: [], neutralizadas: 0, recortado: false, omitidos: [] };
  }

  const resultado: ResultadoAdjuntos = { adjuntos: [], neutralizadas: 0, recortado: false, omitidos: [] };
  let restante = tope;
  for (const fila of data ?? []) {
    if (restante <= 0) {
      resultado.recortado = true;
      resultado.omitidos.push(fila.nombre);
      continue;
    }
    try {
      const { data: archivo, error: eDescarga } = await supabase.storage.from(BUCKET).download(fila.storage_path);
      if (eDescarga || !archivo) throw eDescarga ?? new Error("sin archivo");
      const crudo = await textoDe(fila.storage_path, await archivo.arrayBuffer());
      if (!crudo || !crudo.trim()) {
        resultado.omitidos.push(fila.nombre);
        continue;
      }
      const saneado = sanearTextoTercero(crudo, restante);
      restante -= saneado.texto.length;
      resultado.neutralizadas += saneado.neutralizadas;
      resultado.recortado ||= saneado.recortado;
      resultado.adjuntos.push({ nombre: fila.nombre, tipo: fila.tipo_doc === "TDR" ? "términos de referencia" : "términos", texto: saneado.texto });
    } catch (e) {
      console.error("IA: no se pudo leer el adjunto", fila.storage_path, e instanceof Error ? e.message : e);
      resultado.omitidos.push(fila.nombre);
    }
  }
  return resultado;
}
