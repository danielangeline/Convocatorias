import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { DocumentoAdmin, TipoDocumento } from "@/lib/types";
import type { Resultado } from "./administradores";

/**
 * Adjuntos de una convocatoria (CU-03, RF-07, docs/05 §9.14).
 *
 * El archivo nunca pasa por el servidor: una función de Vercel no admite un
 * cuerpo de 20 MB. Va del navegador a Storage por una URL firmada de subida
 * que emite este módulo, con la ruta que decide el servidor y la RLS del
 * bucket exigiendo administrador con MFA en los dos pasos.
 *
 * Quien llama ya comprobó la sesión (`conAdministrador` o el layout del panel),
 * así que todo se hace con esa sesión y la RLS vuelve a decidir.
 */

export const BUCKET = "documentos-convocatorias";

type Cuerpo = Record<string, unknown> | null;
type Rechazo = { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const invalido = (error: string): Rechazo => ({ ok: false, status: 400, error });

const TIPOS_DOC: TipoDocumento[] = ["TDR", "terminos", "anexo", "formato"];

/** RNF-18: 20 MB. El bucket lo repite, así que una subida directa tampoco pasa. */
export const TAMANO_MAXIMO = 20 * 1024 * 1024;

/**
 * RNF-18: extensiones admitidas y el tipo MIME que le corresponde a cada una.
 * Se valida la pareja, no solo el MIME: el navegador declara el tipo y podría
 * mentir, pero la extensión la fija el servidor desde el nombre del archivo.
 */
export const FORMATOS: Record<string, string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

export const EXTENSIONES = Object.keys(FORMATOS);

const texto = (valor: unknown, maximo: number): string =>
  typeof valor === "string" ? valor.trim().slice(0, maximo) : "";

/** Extensión en minúsculas del nombre original, sin el punto. */
export function extensionDe(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf(".");
  return punto === -1 ? "" : nombreArchivo.slice(punto + 1).toLowerCase();
}

const aDocumento = (d: {
  id: string;
  tipo_doc: string;
  nombre: string;
  tipo_mime: string | null;
  tamano_bytes: number | string | null;
  creado_at: string;
}): DocumentoAdmin => ({
  id: d.id,
  tipo: d.tipo_doc as TipoDocumento,
  nombre: d.nombre,
  tipoMime: d.tipo_mime ?? "",
  tamanoBytes: d.tamano_bytes === null ? null : Number(d.tamano_bytes),
  creadoAt: d.creado_at,
});

const COLUMNAS = "id, tipo_doc, nombre, tipo_mime, tamano_bytes, creado_at";

export async function listarDocumentos(convocatoriaId: string): Promise<DocumentoAdmin[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos_convocatoria")
    .select(COLUMNAS)
    .eq("convocatoria_id", convocatoriaId)
    .order("creado_at");
  if (error) throw new Error(`No se pudieron leer los adjuntos: ${error.message}`);
  return (data ?? []).map(aDocumento);
}

/** Valida lo que describe al archivo. Compartido por los pasos 1 y 3. */
function datosDelAdjunto(cuerpo: Cuerpo): { ok: true; nombre: string; tipo: TipoDocumento; extension: string } | Rechazo {
  const nombre = texto(cuerpo?.nombre, 200);
  const tipo = cuerpo?.tipo as TipoDocumento;
  const extension = texto(cuerpo?.extension, 10).replace(/^\./, "").toLowerCase();
  if (!nombre) return invalido("Escribe un nombre descriptivo para el documento.");
  if (!TIPOS_DOC.includes(tipo)) return invalido("Tipo de documento no válido.");
  if (!EXTENSIONES.includes(extension)) {
    return invalido(`Formato no admitido. Se aceptan ${EXTENSIONES.join(", ")} (RNF-18).`);
  }
  return { ok: true, nombre, tipo, extension };
}

/** La convocatoria tiene que existir y ser visible para quien llama. */
async function existeConvocatoria(convocatoriaId: string): Promise<boolean> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("convocatorias").select("id").eq("id", convocatoriaId).maybeSingle();
  return Boolean(data);
}

/**
 * Paso 1 · Reserva el id del adjunto y devuelve una URL firmada de subida.
 * La ruta la decide el servidor: `{convocatoria}/{documento}.{ext}`. El nombre
 * del archivo original no llega a la ruta; vive en la columna `nombre`.
 */
export async function urlDeSubida(
  convocatoriaId: string,
  cuerpo: Cuerpo
): Promise<Resultado<{ documentoId: string; ruta: string; token: string }>> {
  const datos = datosDelAdjunto(cuerpo);
  if (!datos.ok) return datos;

  const tamano = Number(cuerpo?.tamanoBytes);
  if (!Number.isFinite(tamano) || tamano <= 0) return invalido("No pudimos leer el tamaño del archivo.");
  if (tamano > TAMANO_MAXIMO) return invalido("El archivo supera los 20 MB permitidos (RNF-18).");

  if (!(await existeConvocatoria(convocatoriaId))) {
    return { ok: false, status: 404, error: "La convocatoria no existe." };
  }

  const documentoId = crypto.randomUUID();
  const ruta = `${convocatoriaId}/${documentoId}.${datos.extension}`;

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) {
    console.error("Adjuntos: no se pudo firmar la subida", error?.message);
    return { ok: false, status: 500, error: "No pudimos preparar la subida. Intenta de nuevo." };
  }
  return { ok: true, datos: { documentoId, ruta, token: data.token } };
}

/**
 * Paso 3 · Registra la fila, pero solo si el objeto existe de verdad en el
 * bucket, y con el tamaño y el tipo que reporta Storage — no los que declaró
 * el navegador.
 */
export async function registrarDocumento(convocatoriaId: string, cuerpo: Cuerpo): Promise<Resultado<DocumentoAdmin>> {
  const datos = datosDelAdjunto(cuerpo);
  if (!datos.ok) return datos;

  const documentoId = texto(cuerpo?.documentoId, 36);
  if (!UUID.test(documentoId)) return invalido("Identificador del documento no válido.");

  const ruta = `${convocatoriaId}/${documentoId}.${datos.extension}`;
  const supabase = await crearClienteServidor();

  const { data: objetos, error: eLista } = await supabase.storage
    .from(BUCKET)
    .list(convocatoriaId, { search: `${documentoId}.${datos.extension}`, limit: 1 });
  if (eLista) {
    console.error("Adjuntos: no se pudo consultar el bucket", eLista.message);
    return { ok: false, status: 500, error: "No pudimos confirmar la subida. Intenta de nuevo." };
  }
  const objeto = objetos?.[0];
  if (!objeto) return invalido("El archivo no llegó a subirse. Inténtalo otra vez.");

  const metadatos = (objeto.metadata ?? {}) as { size?: number; mimetype?: string };
  const tamano = Number(metadatos.size ?? 0);
  const mime = metadatos.mimetype ?? "";

  // El bucket ya rechaza lo que se pase de tamaño o de tipo; esto lo repite
  // sobre lo que quedó guardado y, además, exige que el tipo case con la
  // extensión que el servidor puso en la ruta (RNF-18).
  if (tamano > TAMANO_MAXIMO) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return invalido("El archivo supera los 20 MB permitidos (RNF-18).");
  }
  if (!FORMATOS[datos.extension].includes(mime)) {
    await supabase.storage.from(BUCKET).remove([ruta]);
    return invalido("El contenido del archivo no corresponde a su extensión.");
  }

  const { data, error } = await supabase
    .from("documentos_convocatoria")
    .insert({
      id: documentoId,
      convocatoria_id: convocatoriaId,
      tipo_doc: datos.tipo,
      nombre: datos.nombre,
      storage_path: ruta,
      tipo_mime: mime,
      tamano_bytes: tamano,
    })
    .select(COLUMNAS)
    .single();
  if (error) {
    // Sin fila no hay descarga posible, así que el objeto no se queda suelto.
    await supabase.storage.from(BUCKET).remove([ruta]);
    if (error.code === "23505") return { ok: false, status: 409, error: "Ese documento ya estaba registrado." };
    console.error("Adjuntos: no se pudo registrar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos guardar el documento. Intenta de nuevo." };
  }
  return { ok: true, datos: aDocumento(data) };
}

/**
 * CU-03 1a · Renombrar o cambiar el tipo. El trigger de la base impide que por
 * aquí se cambie el archivo: para reemplazarlo se quita y se sube otro.
 */
export async function renombrarDocumento(
  convocatoriaId: string,
  documentoId: string,
  cuerpo: Cuerpo
): Promise<Resultado<DocumentoAdmin>> {
  const cambios: Record<string, unknown> = {};
  if (cuerpo?.nombre !== undefined) {
    const nombre = texto(cuerpo.nombre, 200);
    if (!nombre) return invalido("Escribe un nombre descriptivo para el documento.");
    cambios.nombre = nombre;
  }
  if (cuerpo?.tipo !== undefined) {
    const tipo = cuerpo.tipo as TipoDocumento;
    if (!TIPOS_DOC.includes(tipo)) return invalido("Tipo de documento no válido.");
    cambios.tipo_doc = tipo;
  }
  if (Object.keys(cambios).length === 0) return invalido("No hay cambios que guardar.");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos_convocatoria")
    .update(cambios)
    .eq("id", documentoId)
    .eq("convocatoria_id", convocatoriaId)
    .select(COLUMNAS)
    .maybeSingle();
  if (error) {
    console.error("Adjuntos: no se pudo renombrar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };
  return { ok: true, datos: aDocumento(data) };
}

/** CU-03 1a · Quita la fila y el objeto. */
export async function quitarDocumento(convocatoriaId: string, documentoId: string): Promise<Resultado<null>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("documentos_convocatoria")
    .delete()
    .eq("id", documentoId)
    .eq("convocatoria_id", convocatoriaId)
    .select("storage_path")
    .maybeSingle();
  if (error) {
    // RN-01, CU-03 1b: una publicada conserva al menos un adjunto (docs/05 §9.14).
    if (error.hint === "publicada_incompleta") {
      return {
        ok: false,
        status: 409,
        error: "Una convocatoria publicada necesita al menos un documento adjunto. Sube el reemplazo antes de quitar este, o despublícala.",
      };
    }
    console.error("Adjuntos: no se pudo quitar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos quitar el documento. Intenta de nuevo." };
  }
  if (!data) return { ok: false, status: 404, error: "El documento no existe." };

  const { error: eObjeto } = await supabase.storage.from(BUCKET).remove([data.storage_path]);
  if (eObjeto) {
    // La fila ya no está, así que el adjunto desapareció para todos. El objeto
    // suelto se anota para limpiarlo; no se le devuelve un error al usuario.
    console.error("Adjuntos: fila borrada pero el objeto sigue en el bucket", data.storage_path, eObjeto.message);
  }
  return { ok: true, datos: null };
}

/**
 * RNF-16 · URL firmada de descarga, 15 minutos, con el nombre descriptivo como
 * nombre del archivo. La autorización la decide la RLS: la fila se lee con la
 * sesión de quien pide y, si no puede verla, el documento no existe para él.
 */
export async function enlaceDeDescarga(
  convocatoriaId: string,
  documentoId: string
): Promise<Resultado<{ url: string; nombre: string }>> {
  const supabase = await crearClienteServidor();
  const { data: fila, error } = await supabase
    .from("documentos_convocatoria")
    .select("nombre, storage_path")
    .eq("id", documentoId)
    .eq("convocatoria_id", convocatoriaId)
    .maybeSingle();
  if (error) {
    console.error("Adjuntos: no se pudo leer el documento", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos preparar la descarga. Intenta de nuevo." };
  }
  if (!fila) return { ok: false, status: 404, error: "El documento no existe." };

  const extension = extensionDe(fila.storage_path);
  const nombreDescarga = extensionDe(fila.nombre) === extension ? fila.nombre : `${fila.nombre}.${extension}`;

  const { data, error: eUrl } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(fila.storage_path, 900, { download: nombreDescarga });
  if (eUrl || !data) {
    console.error("Adjuntos: no se pudo firmar la descarga", eUrl?.message);
    return { ok: false, status: 500, error: "No pudimos preparar la descarga. Intenta de nuevo." };
  }
  return { ok: true, datos: { url: data.signedUrl, nombre: nombreDescarga } };
}
