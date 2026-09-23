import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * URL firmada de descarga con el nombre descriptivo (RNF-16).
 *
 * No se usa la opción `download` de `createSignedUrl`: storage-js codifica el
 * nombre con URLSearchParams y después pasa la URL entera por encodeURI, así que
 * "Términos.pdf" se descargaba como "T%C3%A9rminos.pdf" (hallazgo de la sesión
 * 016). Aquí se firma sin nombre y el parámetro se añade codificado una vez.
 */
export async function firmarDescarga(
  supabase: SupabaseClient,
  bucket: string,
  ruta: string,
  nombre: string,
  segundos = 900
): Promise<{ url: string } | { error: string }> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(ruta, segundos);
  if (error || !data) return { error: error?.message ?? "sin URL" };
  return { url: `${data.signedUrl}&download=${encodeURIComponent(nombre)}` };
}
