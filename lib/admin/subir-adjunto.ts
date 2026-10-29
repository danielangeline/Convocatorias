import type { DocumentoAdmin, TipoDocumento } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { crearClienteNavegador } from "@/lib/supabase/cliente";

/**
 * Subida de un adjunto de convocatoria desde el navegador (CU-03, RF-07,
 * docs/05 §9.14). La usan el editor y la carga masiva (CU-50).
 *
 * El archivo va del navegador a Storage por una URL firmada que emite el
 * servidor; al servidor no llega. Lo que se valida aquí —extensión y tamaño—
 * lo vuelve a validar el servidor y lo repite el propio bucket, así que no es
 * la barrera, solo el aviso temprano (RNF-18, RNF-20).
 */

const BUCKET = "documentos-convocatorias";
export const TAMANO_MAXIMO_ADJUNTO = 20 * 1024 * 1024;
export const EXTENSIONES_ADJUNTO = ["pdf", "doc", "docx", "xls", "xlsx", "zip"];
export const TIPOS_ADJUNTO: TipoDocumento[] = ["TDR", "terminos", "anexo", "formato"];

export const extensionDe = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto === -1 ? "" : nombre.slice(punto + 1).toLowerCase();
};

export const sinExtension = (nombre: string) => {
  const punto = nombre.lastIndexOf(".");
  return punto <= 0 ? nombre : nombre.slice(0, punto);
};

export async function subirAdjunto(
  convocatoriaId: string,
  archivo: File,
  tipo: TipoDocumento
): Promise<{ ok: true; documento: DocumentoAdmin } | { ok: false; error: string }> {
  const extension = extensionDe(archivo.name);
  if (!EXTENSIONES_ADJUNTO.includes(extension)) {
    return { ok: false, error: `Formato no admitido. Se aceptan ${EXTENSIONES_ADJUNTO.join(", ")}.` };
  }
  if (archivo.size > TAMANO_MAXIMO_ADJUNTO) return { ok: false, error: "El archivo supera los 20 MB permitidos." };

  const base = `/api/admin/convocatorias/${convocatoriaId}/documentos`;
  const nombre = sinExtension(archivo.name).slice(0, 200);

  // Paso 1: el servidor decide la ruta y firma la subida.
  const firma = await peticionAdmin<{ documentoId: string; ruta: string; token: string }>(`${base}/subida`, "POST", {
    nombre,
    tipo,
    extension,
    tamanoBytes: archivo.size,
  });
  if (!firma.ok) return firma;

  // Paso 2: el archivo va directo al bucket.
  const supabase = crearClienteNavegador();
  const { error: eSubida } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(firma.datos.ruta, firma.datos.token, archivo, { contentType: archivo.type });
  if (eSubida) return { ok: false, error: "No pudimos subir el archivo. Revisa su tamaño y su formato e inténtalo otra vez." };

  // Paso 3: el servidor registra la fila con el tamaño y el tipo reales.
  const registro = await peticionAdmin<DocumentoAdmin>(base, "POST", {
    documentoId: firma.datos.documentoId,
    nombre,
    tipo,
    extension,
  });
  if (!registro.ok) return registro;
  return { ok: true, documento: registro.datos };
}
