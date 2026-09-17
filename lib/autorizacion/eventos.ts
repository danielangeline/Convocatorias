import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Registra un acceso denegado en `eventos_seguridad` con service_role: el
 * cliente no puede escribir esa tabla (RF-65, RNF-26, RNF-30). Un fallo al
 * registrar no abre el acceso: solo se informa en el log del servidor.
 */
export async function registrarAccesoDenegado(datos: {
  usuarioId: string | null;
  ruta: string;
  ip: string | null;
  detalle: string;
}) {
  try {
    const servicio = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await servicio.from("eventos_seguridad").insert({
      tipo: "acceso_denegado",
      usuario_id: datos.usuarioId,
      ip: datos.ip,
      ruta: datos.ruta.slice(0, 500),
      detalle: datos.detalle,
    });
    if (error) console.error("No se pudo registrar acceso_denegado", error.message);
  } catch (e) {
    console.error("No se pudo registrar acceso_denegado", e);
  }
}

export function ipDeCabeceras(cabeceras: Headers): string | null {
  return cabeceras.get("x-forwarded-for")?.split(",")[0]?.trim() || cabeceras.get("x-real-ip") || null;
}
