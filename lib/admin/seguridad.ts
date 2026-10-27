import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { EventoSeguridad, TipoEventoSeguridad } from "@/lib/types";
import { borrarContador } from "@/lib/limite-tasa";
import type { Resultado } from "./administradores";

// CU-39 · RF-65 · Eventos de seguridad reales (docs/05 §9.9). Con la sesión del
// administrador: la RLS solo deja leer a quien es administrador con aal2.
// Hasta la sesión 030 la pantalla leía los datos de ejemplo del store.

export const LIMITE_EVENTOS = 500;

type Fila = {
  id: string;
  tipo: TipoEventoSeguridad;
  ip: string | null;
  ruta: string | null;
  detalle: string | null;
  bloqueado_hasta: string | null;
  fecha: string;
  perfiles: { nombre: string | null; nombre_empresa: string | null } | null;
};

/** Los más recientes primero, hasta `LIMITE_EVENTOS`, con el instante de la consulta (para saber qué bloqueo sigue activo). */
export async function listarEventosSeguridad(): Promise<{ eventos: EventoSeguridad[]; ahora: number }> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("eventos_seguridad")
    // Dos claves a perfiles desde la sesión 030 (usuario_id y liberado_por): se nombra la del autor.
    .select("id, tipo, ip, ruta, detalle, bloqueado_hasta, fecha, perfiles!eventos_seguridad_usuario_id_fkey (nombre, nombre_empresa)")
    .order("fecha", { ascending: false })
    .limit(LIMITE_EVENTOS);
  if (error) throw new Error(`Eventos de seguridad: listar falló (${error.code})`);
  const eventos = (data as unknown as Fila[]).map((f) => ({
    id: f.id,
    tipo: f.tipo,
    usuarioNombre: f.perfiles ? (f.perfiles.nombre_empresa || f.perfiles.nombre || null) : null,
    ip: f.ip ?? "—",
    ruta: f.ruta ?? "—",
    detalle: f.detalle ?? "",
    bloqueadoHasta: f.bloqueado_hasta,
    fecha: f.fecha,
  }));
  return { eventos, ahora: Date.now() };
}

/**
 * CU-40 · RF-67 · Libera un bloqueo activo. Primero se borra el contador en
 * Upstash —si eso falla no se toca nada, para no decir "liberado" con la
 * persona aún bloqueada— y después la base deja el evento vencido y con quién
 * lo liberó (`liberar_bloqueo`, que repite que sea administrador con aal2).
 */
export async function liberarBloqueo(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: evento } = await supabase
    .from("eventos_seguridad")
    .select("clave_limite, bloqueado_hasta, tipo")
    .eq("id", id)
    .maybeSingle();
  if (!evento || evento.tipo !== "limite_tasa" || !evento.bloqueado_hasta || new Date(evento.bloqueado_hasta).getTime() <= Date.now()) {
    return { ok: false, status: 404, error: "Ese bloqueo ya no está activo." };
  }
  if (evento.clave_limite && !(await borrarContador(evento.clave_limite))) {
    return { ok: false, status: 503, error: "No pudimos liberar el bloqueo en este momento. Intenta de nuevo." };
  }
  const { error } = await supabase.rpc("liberar_bloqueo", { p_evento: id });
  if (error) {
    if (error.hint === "no_es_admin") return { ok: false, status: 404, error: "No encontrado." };
    if (error.hint === "bloqueo_no_existe") return { ok: false, status: 404, error: "Ese bloqueo ya no está activo." };
    console.error("Seguridad: liberar falló", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
  }
  return { ok: true, aviso: "Bloqueo liberado: ya puede volver a intentarlo." };
}
