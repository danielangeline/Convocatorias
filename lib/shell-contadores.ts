import { crearClienteServidor } from "@/lib/supabase/servidor";

// Contadores del menú lateral (solo presentación). Leen con la sesión del
// usuario, así que la RLS decide qué cuenta cada uno.

/** Solicitudes nuevas que esperan respuesta del consultor (RF-30). */
export async function contarSolicitudesConsultor(): Promise<number> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .from("encargos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "pendiente");
  if (error) console.error("Menú: no se pudieron contar las solicitudes", error.code, error.message);
  return count ?? 0;
}

/** Perfiles de consultor en revisión, para el administrador (RF-34). */
export async function contarPerfilesEnRevision(): Promise<number> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .from("consultor_perfiles")
    .select("id", { count: "exact", head: true })
    .eq("estado_perfil", "en_revision");
  if (error) console.error("Menú: no se pudieron contar los perfiles en revisión", error.code, error.message);
  return count ?? 0;
}
