import "server-only";

/**
 * Interfaz propia del servicio de IA (RNF-22). El resto del módulo solo conoce
 * estos tipos: el proveedor concreto (hoy OpenAI, docs/04 §8.3) queda detrás de
 * `proveedorIA()`, y el modelo con su precio es un dato de la plantilla activa
 * (docs/05 §9.26). Cambiar de proveedor es escribir otra implementación de
 * `ProveedorIA`, no tocar la generación.
 */

export interface SeccionRedactada {
  titulo: string;
  contenido: string;
}

export interface PeticionRedaccion {
  modelo: string;
  /** La plantilla activa: reglas de veracidad, estructura y pendientes (RF-63). */
  instrucciones: string;
  /** El contexto armado por `lib/ia/contexto.ts`. */
  mensaje: string;
  /** Tope de la respuesta, en tokens. */
  maxTokensSalida: number;
  /** RNF-21: pasado este plazo la petición se aborta y falla sin crédito. */
  plazoMs: number;
}

export interface ResultadoRedaccion {
  titulo: string;
  secciones: SeccionRedactada[];
  tokensEntrada: number;
  tokensSalida: number;
}

/** Fallo del proveedor. Lleva los tokens si alcanzó a consumirlos (RF-52). */
export class ErrorIA extends Error {
  constructor(
    message: string,
    readonly motivo: "plazo" | "proveedor" | "respuesta_invalida" | "configuracion",
    readonly tokensEntrada: number | null = null,
    readonly tokensSalida: number | null = null
  ) {
    super(message);
    this.name = "ErrorIA";
  }
}

/** CU-43, RF-96 · Pedir la propuesta de proyecto a partir de una explicación. */
export interface PeticionEstructuracion {
  modelo: string;
  instrucciones: string;
  mensaje: string;
  /** El esquema JSON estricto de la respuesta (`lib/ia/estructurar.ts`). */
  esquema: Record<string, unknown>;
  maxTokensSalida: number;
  plazoMs: number;
}

export interface ResultadoEstructuracion {
  /** El JSON tal como lo devolvió el modelo: lo valida `leerPropuesta`. */
  json: unknown;
  tokensEntrada: number;
  tokensSalida: number;
}

/** RF-97 · Transcribir el dictado. */
export interface PeticionTranscripcion {
  modelo: string;
  audio: Blob;
  nombreArchivo: string;
  plazoMs: number;
}

export interface ResultadoTranscripcion {
  texto: string;
  /** Segundos de audio facturados, si el proveedor los informa. */
  segundos: number | null;
}

export interface ProveedorIA {
  readonly nombre: string;
  redactar(peticion: PeticionRedaccion): Promise<ResultadoRedaccion>;
  estructurar(peticion: PeticionEstructuracion): Promise<ResultadoEstructuracion>;
  transcribir(peticion: PeticionTranscripcion): Promise<ResultadoTranscripcion>;
}

/** Esquema de la respuesta: un documento con título y secciones. */
export const ESQUEMA_DOCUMENTO = {
  type: "object",
  additionalProperties: false,
  required: ["titulo", "secciones"],
  properties: {
    titulo: { type: "string" },
    secciones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "contenido"],
        properties: {
          titulo: { type: "string" },
          contenido: { type: "string" },
        },
      },
    },
  },
} as const;

/** Valida la forma de la respuesta del modelo: nunca se guarda algo a medias. */
export function leerDocumentoRedactado(json: unknown): { titulo: string; secciones: SeccionRedactada[] } | null {
  if (!json || typeof json !== "object") return null;
  const { titulo, secciones } = json as { titulo?: unknown; secciones?: unknown };
  if (typeof titulo !== "string" || !titulo.trim() || !Array.isArray(secciones) || secciones.length === 0) return null;
  const limpias: SeccionRedactada[] = [];
  for (const s of secciones) {
    if (!s || typeof s !== "object") return null;
    const { titulo: t, contenido: c } = s as { titulo?: unknown; contenido?: unknown };
    if (typeof t !== "string" || typeof c !== "string" || !t.trim()) return null;
    limpias.push({ titulo: t.trim().replace(/^#+\s*/, ""), contenido: c.trim() });
  }
  return { titulo: titulo.trim(), secciones: limpias };
}
