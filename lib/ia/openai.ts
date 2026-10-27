import "server-only";
import {
  ESQUEMA_DOCUMENTO,
  ErrorIA,
  leerDocumentoRedactado,
  type PeticionEstructuracion,
  type PeticionRedaccion,
  type PeticionTranscripcion,
  type ProveedorIA,
  type ResultadoEstructuracion,
  type ResultadoRedaccion,
  type ResultadoTranscripcion,
} from "./tipos";

/**
 * Implementación de `ProveedorIA` sobre la API de OpenAI (Chat Completions con
 * salida estructurada, y transcripción de audio desde la sesión 030). Sesión
 * 026: el Product Owner eligió OpenAI. La clave vive en `OPENAI_API_KEY`
 * (servidor, nunca `NEXT_PUBLIC_*` — RNF-26).
 */

function clave(): string {
  const valor = process.env.OPENAI_API_KEY;
  if (!valor) throw new ErrorIA("Falta OPENAI_API_KEY", "configuracion");
  return valor;
}

async function pedir(url: string, init: RequestInit, plazoMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(plazoMs) });
  } catch (e) {
    const plazo = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    throw new ErrorIA(plazo ? "El proveedor de IA no respondió a tiempo" : "No se pudo contactar al proveedor de IA", plazo ? "plazo" : "proveedor");
  }
}

/** Una llamada de Chat Completions con salida JSON estricta; devuelve el JSON y el uso. */
async function completarJson(p: {
  modelo: string;
  instrucciones: string;
  mensaje: string;
  nombreEsquema: string;
  esquema: Record<string, unknown>;
  maxTokensSalida: number;
  plazoMs: number;
}): Promise<{ json: unknown; tokensEntrada: number; tokensSalida: number }> {
  const respuesta = await pedir(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${clave()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: p.modelo,
        max_completion_tokens: p.maxTokensSalida,
        messages: [
          { role: "developer", content: p.instrucciones },
          { role: "user", content: p.mensaje },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: p.nombreEsquema, strict: true, schema: p.esquema },
        },
      }),
    },
    p.plazoMs
  );

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
  return { json: contenido, tokensEntrada: entrada ?? 0, tokensSalida: salida ?? 0 };
}

export const proveedorOpenAI: ProveedorIA = {
  nombre: "openai",

  async redactar(p: PeticionRedaccion): Promise<ResultadoRedaccion> {
    const r = await completarJson({ ...p, nombreEsquema: "documento_base", esquema: ESQUEMA_DOCUMENTO });
    const documento = leerDocumentoRedactado(r.json);
    if (!documento) {
      throw new ErrorIA("La respuesta del modelo no tiene la forma esperada", "respuesta_invalida", r.tokensEntrada, r.tokensSalida);
    }
    return { ...documento, tokensEntrada: r.tokensEntrada, tokensSalida: r.tokensSalida };
  },

  async estructurar(p: PeticionEstructuracion): Promise<ResultadoEstructuracion> {
    return completarJson({ ...p, nombreEsquema: "propuesta_proyecto" });
  },

  async transcribir(p: PeticionTranscripcion): Promise<ResultadoTranscripcion> {
    const formulario = new FormData();
    formulario.append("file", p.audio, p.nombreArchivo);
    formulario.append("model", p.modelo);
    formulario.append("language", "es");
    formulario.append("response_format", "json");

    const respuesta = await pedir(
      "https://api.openai.com/v1/audio/transcriptions",
      { method: "POST", headers: { Authorization: `Bearer ${clave()}` }, body: formulario },
      p.plazoMs
    );
    const json = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      const detalle = json?.error?.code ?? json?.error?.type ?? respuesta.status;
      throw new ErrorIA(`El proveedor de IA respondió ${respuesta.status} (${detalle})`, "proveedor");
    }
    if (typeof json?.text !== "string") throw new ErrorIA("La transcripción no tiene la forma esperada", "respuesta_invalida");
    const uso = json?.usage as { type?: string; seconds?: number } | undefined;
    return { texto: json.text.trim(), segundos: uso?.type === "duration" && typeof uso.seconds === "number" ? uso.seconds : null };
  },
};
