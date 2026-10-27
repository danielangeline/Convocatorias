import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { UUID } from "@/lib/api-empresa";

/**
 * RF-103, CU-45 · Convocatorias guardadas por la empresa (docs/05 §9.34). Todo
 * con la sesión de la empresa: la RLS solo deja ver, guardar y quitar las
 * suyas, y solo guardar las que ya puede ver (RN-30, RN-33).
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

/** Ids de las convocatorias que la empresa guardó, de la más reciente a la más antigua. */
export const listarGuardadas = cache(async (): Promise<string[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("convocatorias_guardadas")
    .select("convocatoria_id, creado_at")
    .order("creado_at", { ascending: false });
  if (error) {
    console.error("Guardadas: no se pudieron listar", error.code, error.message);
    return [];
  }
  return data.map((f) => f.convocatoria_id as string);
});

export async function guardarConvocatoria(convocatoriaId: unknown): Promise<Resultado<null>> {
  if (typeof convocatoriaId !== "string" || !UUID.test(convocatoriaId)) {
    return { ok: false, status: 400, error: "Convocatoria no válida." };
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("convocatorias_guardadas")
    .upsert({ convocatoria_id: convocatoriaId }, { onConflict: "usuario_id,convocatoria_id", ignoreDuplicates: true });
  if (error) {
    // 42501: la RLS no la deja guardar (no la ve o no es empresa). 23503: no existe.
    if (error.code === "42501" || error.code === "23503") return { ok: false, status: 404, error: "La convocatoria no existe." };
    console.error("Guardadas: no se pudo guardar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos guardar la convocatoria. Inténtalo otra vez." };
  }
  return { ok: true, datos: null };
}

export async function quitarGuardada(convocatoriaId: string): Promise<Resultado<null>> {
  if (!UUID.test(convocatoriaId)) return { ok: false, status: 400, error: "Convocatoria no válida." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("convocatorias_guardadas").delete().eq("convocatoria_id", convocatoriaId);
  if (error) {
    console.error("Guardadas: no se pudo quitar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos quitarla de tus guardadas. Inténtalo otra vez." };
  }
  return { ok: true, datos: null };
}
