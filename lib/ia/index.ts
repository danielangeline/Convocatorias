import "server-only";
import { proveedorOpenAI } from "./openai";
import { proveedorPrueba } from "./prueba";
import type { ProveedorIA } from "./tipos";

export * from "./tipos";

/**
 * El proveedor en uso (RNF-22). OpenAI por defecto; el de prueba solo con
 * `IA_PROVEEDOR=prueba` y nunca en el despliegue de producción, para que un
 * error de configuración no entregue documentos vacíos a una empresa real.
 */
export function proveedorIA(): ProveedorIA {
  if (process.env.IA_PROVEEDOR === "prueba" && process.env.VERCEL_ENV !== "production") return proveedorPrueba;
  return proveedorOpenAI;
}

/** RNF-21: la generación falla de forma controlada pasados 120 s. */
export const PLAZO_IA_MS = 110_000;
