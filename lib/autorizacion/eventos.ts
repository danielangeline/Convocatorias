import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { TipoEventoSeguridad } from "@/lib/types";

/**
 * Escribe un evento en `eventos_seguridad` con service_role: el cliente no
 * puede escribir esa tabla (RF-65, RNF-26). Un fallo al registrar no cambia la
 * decisión que ya se tomó: solo se informa en el log del servidor.
 */
export async function registrarEventoSeguridad(
  tipo: TipoEventoSeguridad,
  datos: { usuarioId: string | null; ruta: string; ip: string | null; detalle: string }
) {
  try {
    const servicio = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await servicio.from("eventos_seguridad").insert({
      tipo,
      usuario_id: datos.usuarioId,
      ip: datos.ip,
      ruta: datos.ruta.slice(0, 500),
      detalle: datos.detalle,
    });
    if (error) console.error(`No se pudo registrar ${tipo}`, error.message);
  } catch (e) {
    console.error(`No se pudo registrar ${tipo}`, e);
  }
}

/** Acceso denegado (RNF-30): no abre el acceso aunque falle el registro. */
export async function registrarAccesoDenegado(datos: {
  usuarioId: string | null;
  ruta: string;
  ip: string | null;
  detalle: string;
}) {
  await registrarEventoSeguridad("acceso_denegado", datos);
}

export function ipDeCabeceras(cabeceras: Headers): string | null {
  return cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || null;
}
