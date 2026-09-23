/**
 * Llamada del navegador a un endpoint del panel (`/api/admin/...`). Devuelve el
 * error legible que responde el servidor; la pantalla no decide nada por su
 * cuenta (RNF-20): muestra el error o vuelve a leer los datos.
 */
export async function peticionAdmin<T = unknown>(
  url: string,
  metodo: "POST" | "PATCH",
  cuerpo: unknown
): Promise<{ ok: true; datos: T; aviso: string | null } | { ok: false; error: string }> {
  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo ?? {}),
    });
    const json = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) return { ok: false, error: json.error ?? "No pudimos completar la acción. Intenta de nuevo." };
    return { ok: true, datos: json.datos as T, aviso: typeof json.aviso === "string" ? json.aviso : null };
  } catch {
    return { ok: false, error: "No hay conexión con el servidor. Intenta de nuevo." };
  }
}
