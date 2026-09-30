export type Respuesta<T = unknown> = { ok: true; datos: T } | { ok: false; error: string };

/**
 * Llama a un endpoint propio con JSON y devuelve el error que la API ya
 * redactó para la pantalla. No autoriza nada: el servidor decide.
 */
export async function pedir<T = unknown>(url: string, cuerpo?: unknown, method: "POST" | "PATCH" = "POST"): Promise<Respuesta<T>> {
  const respuesta = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo ?? {}),
  }).catch(() => null);
  const json = respuesta ? await respuesta.json().catch(() => ({})) : {};
  if (!respuesta?.ok) return { ok: false, error: json.error ?? "No pudimos completar la acción. Intenta de nuevo." };
  return { ok: true, datos: json.datos as T };
}
