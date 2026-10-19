import "server-only";
import {
  ESQUEMA_DOCUMENTO,
  ErrorIA,
  leerDocumentoRedactado,
  type PeticionRedaccion,
  type ProveedorIA,
  type ResultadoRedaccion,
} from "./tipos";

/**
 * Implementación de `ProveedorIA` sobre la API de OpenAI (Chat Completions con
 * salida estructurada). Sesión 026: el Product Owner eligió OpenAI. La clave
 * vive en `OPENAI_API_KEY` (servidor, nunca `NEXT_PUBLIC_*` — RNF-26).
 */
export const proveedorOpenAI: ProveedorIA = {
  nombre: "openai",
  async redactar(p: PeticionRedaccion): Promise<ResultadoRedaccion> {
    const clave = process.env.OPENAI_API_KEY;
    if (!clave) throw new ErrorIA("Falta OPENAI_API_KEY", "configuracion");

    let respuesta: Response;
    try {
      respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${clave}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: p.modelo,
          max_completion_tokens: p.maxTokensSalida,
          messages: [
            { role: "developer", content: p.instrucciones },
            { role: "user", content: p.mensaje },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "documento_base", strict: true, schema: ESQUEMA_DOCUMENTO },
          },
        }),
        signal: AbortSignal.timeout(p.plazoMs),
      });
    } catch (e) {
      const plazo = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
      throw new ErrorIA(plazo ? "El proveedor de IA no respondió a tiempo" : "No se pudo contactar al proveedor de IA", plazo ? "plazo" : "proveedor");
    }

    const json = await respuesta.json().catch(() => null);
    const uso = json?.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const entrada = uso?.prompt_tokens ?? null;
    const salida = uso?.completion_tokens ?? null;

    if (!respuesta.ok) {
      const detalle = json?.error?.code ?? json?.error?.type ?? respuesta.status;
      throw new ErrorIA(`El proveedor de IA respondió ${respuesta.status} (${detalle})`, "proveedor", entrada, salida);
    }

    const opcion = json?.choices?.[0];
    if (opcion?.finish_reason === "length") {
      throw new ErrorIA("La respuesta del modelo se cortó por longitud", "respuesta_invalida", entrada, salida);
    }
    if (opcion?.message?.refusal) {
      throw new ErrorIA("El modelo rechazó la petición", "respuesta_invalida", entrada, salida);
    }
    let contenido: unknown = null;
    try {
      contenido = JSON.parse(opcion?.message?.content ?? "");
    } catch {
      contenido = null;
    }
    const documento = leerDocumentoRedactado(contenido);
    if (!documento) throw new ErrorIA("La respuesta del modelo no tiene la forma esperada", "respuesta_invalida", entrada, salida);

    return { ...documento, tokensEntrada: entrada ?? 0, tokensSalida: salida ?? 0 };
  },
};
