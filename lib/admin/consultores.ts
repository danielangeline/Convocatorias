import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { firmarDescarga } from "@/lib/supabase/descarga";
import { BUCKET_CV, BUCKET_FOTO } from "@/lib/consultor-perfil-servidor";
import type { ConsultorAdmin, EstadoPerfilConsultor, RedSocialTipo, TipoCategoria } from "@/lib/types";
import type { Resultado } from "./administradores";

/**
 * Consultores en el panel: bandeja de revisión y administración de activos
 * (CU-25, CU-27, RF-34, RF-35 · docs/05 §9.21 · Sprint 4 paso 1b). Quien llama
 * ya comprobó la sesión de administrador con aal2 (`conAdministrador` o el
 * layout del panel). Todo corre con esa sesión: las funciones de la base
 * vuelven a exigir `es_admin()` y bloquean la fila, así que dos
 * administradores no revisan el mismo perfil a la vez.
 */

const ESTADOS: EstadoPerfilConsultor[] = ["incompleto", "en_revision", "aprobado", "rechazado", "suspendido"];
export const esEstadoPerfil = (v: unknown): v is EstadoPerfilConsultor =>
  ESTADOS.includes(v as EstadoPerfilConsultor);

const MOTIVO_MAXIMO = 1000;

// Rechazos de la base por su clave estable (hint).
const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_admin: { status: 404, error: "No encontrado." },
  no_existe: { status: 404, error: "El perfil no existe." },
  estado_no_permite: {
    status: 409,
    error: "El perfil cambió de estado mientras lo revisabas (quizá otro administrador ya actuó). Recarga la página.",
  },
  motivo_vacio: { status: 400, error: "Escribe el motivo." },
};

function traducir(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Consultores (panel): ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

function motivoDe(cuerpo: Record<string, unknown> | null): string | { error: string } {
  const valor = cuerpo?.motivo;
  if (typeof valor !== "string" || !valor.trim()) return { error: "Escribe el motivo." };
  if (valor.trim().length > MOTIVO_MAXIMO) return { error: `El motivo admite hasta ${MOTIVO_MAXIMO} caracteres.` };
  return valor.trim();
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

/**
 * Todos los consultores, o solo los de un estado (la bandeja pide
 * `en_revision`). Los de revisión primero por antigüedad del envío: el que
 * más lleva esperando va arriba.
 */
export async function listarConsultores(estado?: EstadoPerfilConsultor): Promise<ConsultorAdmin[]> {
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("consultor_perfiles")
    .select(
      "id, nombre_profesional, descripcion, foto_path, estado_perfil, motivo_rechazo, revisado_at, " +
        "es_equipo_interno, rating_promedio, total_encargos_completados, actualizado_at"
    );
  consulta = estado ? consulta.eq("estado_perfil", estado).order("actualizado_at") : consulta.order("creado_at", { ascending: false });
  const { data, error } = await consulta;
  if (error) {
    console.error("Consultores (panel): no se pudo listar", error.code, error.message);
    return [];
  }
  const filas = (data ?? []) as unknown as {
    id: string;
    nombre_profesional: string | null;
    descripcion: string | null;
    foto_path: string | null;
    estado_perfil: EstadoPerfilConsultor;
    motivo_rechazo: string | null;
    revisado_at: string | null;
    es_equipo_interno: boolean;
    rating_promedio: number;
    total_encargos_completados: number;
    actualizado_at: string;
  }[];
  if (filas.length === 0) return [];
  const ids = filas.map((f) => f.id);

  const [especialidades, redes, portafolio, encargos, contactos, suspensiones, fotos] = await Promise.all([
    supabase.from("consultor_especialidades").select("consultor_id, categorias (id, nombre, tipo)").in("consultor_id", ids),
    supabase.from("consultor_redes").select("consultor_id, tipo, url").in("consultor_id", ids),
    supabase
      .from("consultor_portafolio")
      .select("consultor_id, nombre_proyecto, entidad, anio, descripcion, resultado")
      .in("consultor_id", ids)
      .order("orden"),
    supabase.from("encargos").select("consultor_id").in("consultor_id", ids).in("estado", ["pendiente", "en_curso"]),
    // Sitio web, hoja de vida y motivo de suspensión no se leen de la tabla
    // (docs/05 §9.11 punto 4 y §9.21): los dan estas funciones.
    Promise.all(ids.map((id) => supabase.rpc("contacto_consultor", { p_consultor: id }).maybeSingle())),
    Promise.all(ids.map((id) => supabase.rpc("suspension_consultor", { p_consultor: id }).maybeSingle())),
    (async () => {
      const rutas = filas.map((f) => f.foto_path).filter((r): r is string => Boolean(r));
      if (rutas.length === 0) return new Map<string, string>();
      const { data: firmadas } = await supabase.storage.from(BUCKET_FOTO).createSignedUrls(rutas, 900);
      return new Map((firmadas ?? []).filter((f) => f.signedUrl && f.path).map((f) => [f.path as string, f.signedUrl]));
    })(),
  ]);
  for (const r of [especialidades, redes, portafolio, encargos]) {
    if (r.error) console.error("Consultores (panel): no se pudo leer", r.error.code, r.error.message);
  }

  return filas.map((f, i) => {
    const contacto = contactos[i].data as { sitio_web: string | null; cv_path: string | null } | null;
    const suspension = suspensiones[i].data as { motivo_suspension: string | null; suspendido_at: string | null } | null;
    return {
      id: f.id,
      nombreProfesional: f.nombre_profesional ?? "",
      descripcion: f.descripcion ?? "",
      sitioWeb: contacto?.sitio_web ?? "",
      fotoUrl: f.foto_path ? fotos.get(f.foto_path) ?? null : null,
      tieneHojaDeVida: Boolean(contacto?.cv_path),
      estadoPerfil: f.estado_perfil,
      motivoRechazo: f.motivo_rechazo,
      motivoSuspension: suspension?.motivo_suspension ?? null,
      suspendidoAt: suspension?.suspendido_at ?? null,
      revisadoAt: f.revisado_at,
      esEquipoInterno: f.es_equipo_interno,
      ratingPromedio: Number(f.rating_promedio),
      totalEncargosCompletados: f.total_encargos_completados,
      encargosActivos: (encargos.data ?? []).filter((e) => e.consultor_id === f.id).length,
      especialidades: ((especialidades.data ?? []) as unknown as {
        consultor_id: string;
        categorias: { id: string; nombre: string; tipo: TipoCategoria } | null;
      }[])
        .filter((e) => e.consultor_id === f.id && e.categorias)
        .map((e) => e.categorias!),
      redes: (redes.data ?? [])
        .filter((r) => r.consultor_id === f.id)
        .map((r) => ({ tipo: r.tipo as RedSocialTipo, url: r.url })),
      portafolio: (portafolio.data ?? [])
        .filter((p) => p.consultor_id === f.id)
        .map((p) => ({
          nombreProyecto: p.nombre_proyecto,
          entidad: p.entidad ?? "",
          anio: p.anio,
          descripcion: p.descripcion ?? "",
          resultado: p.resultado ?? "",
        })),
      actualizadoAt: f.actualizado_at,
    };
  });
}

/** Hoja de vida por URL firmada de 15 minutos (CU-25 paso 2, RNF-16). */
export async function urlHojaDeVida(id: string): Promise<Resultado<{ url: string }>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("contacto_consultor", { p_consultor: id }).maybeSingle();
  if (error) return traducir(error, "leer la hoja de vida");
  const ruta = (data as { cv_path: string | null } | null)?.cv_path;
  if (!ruta) return { ok: false, status: 404, error: "Este consultor no tiene hoja de vida cargada." };

  const { data: perfil } = await supabase.from("consultor_perfiles").select("nombre_profesional").eq("id", id).maybeSingle();
  const nombre = `Hoja de vida - ${perfil?.nombre_profesional?.trim() || "consultor"}.pdf`;
  const firmada = await firmarDescarga(supabase, BUCKET_CV, ruta, nombre);
  if ("error" in firmada) {
    console.error("Consultores (panel): no se pudo firmar la hoja de vida", firmada.error);
    return { ok: false, status: 404, error: "No encontramos el archivo de la hoja de vida." };
  }
  return { ok: true, datos: { url: firmada.url } };
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

/** CU-25 · Aprobar. Hasta el Sprint 5 no crea suscripción (RN-08, RN-11). */
export async function aprobarPerfil(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("revisar_perfil_consultor", { p_id: id, p_aprobar: true });
  if (error) return traducir(error, "aprobar");
  return { ok: true, aviso: "Perfil aprobado: ya aparece en el directorio." };
}

/** CU-25 · Rechazar con motivo obligatorio (RN-13). */
export async function rechazarPerfil(id: string, cuerpo: Record<string, unknown> | null): Promise<Resultado> {
  const motivo = motivoDe(cuerpo);
  if (typeof motivo !== "string") return { ok: false, status: 400, error: "Escribe el motivo del rechazo: el consultor lo verá." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("revisar_perfil_consultor", { p_id: id, p_aprobar: false, p_motivo: motivo });
  if (error) return traducir(error, "rechazar");
  return { ok: true, aviso: "Perfil rechazado. El consultor verá el motivo y podrá reenviarlo." };
}

/** CU-27 · Suspender: cancela sus encargos en curso y pendientes (RN-29). */
export async function suspenderConsultor(
  id: string,
  cuerpo: Record<string, unknown> | null
): Promise<Resultado<{ cancelados: number }>> {
  const motivo = motivoDe(cuerpo);
  if (typeof motivo !== "string") return { ok: false, status: 400, error: "Escribe el motivo de la suspensión: el consultor lo verá." };
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("suspender_consultor", { p_id: id, p_motivo: motivo });
  if (error) return traducir(error, "suspender");
  const cancelados = Number(data ?? 0);
  return {
    ok: true,
    datos: { cancelados },
    aviso:
      cancelados === 0
        ? "Consultor suspendido. No tenía encargos activos."
        : `Consultor suspendido. Se cancelaron ${cancelados} ${cancelados === 1 ? "encargo activo" : "encargos activos"}.`,
  };
}

/** CU-27 · Reactivar: vuelve a aprobado; no revive encargos (3a). */
export async function reactivarConsultor(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("reactivar_consultor", { p_id: id });
  if (error) return traducir(error, "reactivar");
  return { ok: true, aviso: "Consultor reactivado. Los encargos cancelados no se reabren." };
}
