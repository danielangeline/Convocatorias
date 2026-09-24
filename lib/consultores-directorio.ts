import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { firmarDescarga } from "@/lib/supabase/descarga";
import { BUCKET_CV, BUCKET_FOTO } from "@/lib/consultor-perfil-servidor";
import type { ConsultorDirectorio, PerfilConsultorPublico, RedSocialTipo, TipoCategoria } from "@/lib/types";

/**
 * Directorio de consultores y perfil público, vistos por la empresa (RF-26,
 * RF-27, RF-80, CU-20, CU-21 · docs/05 §9.22 · Sprint 4 paso 1c). Todo con la
 * sesión de la empresa: la RLS solo deja leer perfiles aprobados, y el
 * contacto lo decide la base (`contacto_consultor`, la política de
 * `consultor_redes` y la de Storage), que exige un encargo en curso de la
 * pareja. Aquí solo se arma lo que la base ya dejó leer.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

export interface FiltrosDirectorio {
  q?: string;
  especialidades?: string[];
  ratingMin?: number;
}

type Fila = {
  id: string;
  nombre_profesional: string | null;
  descripcion: string | null;
  foto_path: string | null;
  rating_promedio: number;
  total_encargos_completados: number;
};

const COLUMNAS = "id, nombre_profesional, descripcion, foto_path, rating_promedio, total_encargos_completados";

// Aprobados y fuera del equipo interno (RF-26). La suscripción vigente no se
// exige hasta el Sprint 5 (RN-08 transitorio).
async function filasDelDirectorio(ids?: string[]) {
  const supabase = await crearClienteServidor();
  let consulta = supabase
    .from("consultor_perfiles")
    .select(COLUMNAS)
    .eq("estado_perfil", "aprobado")
    .eq("es_equipo_interno", false);
  if (ids) consulta = consulta.in("id", ids);
  const { data, error } = await consulta;
  if (error) console.error("Directorio: no se pudo leer", error.code, error.message);
  return { supabase, filas: (data ?? []) as Fila[] };
}

async function especialidadesDe(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, ids: string[]) {
  if (ids.length === 0) return new Map<string, ConsultorDirectorio["especialidades"]>();
  const { data, error } = await supabase
    .from("consultor_especialidades")
    .select("consultor_id, categorias (id, nombre, tipo)")
    .in("consultor_id", ids);
  if (error) console.error("Directorio: no se pudieron leer las especialidades", error.code, error.message);
  const mapa = new Map<string, ConsultorDirectorio["especialidades"]>();
  for (const e of (data ?? []) as unknown as {
    consultor_id: string;
    categorias: { id: string; nombre: string; tipo: TipoCategoria } | null;
  }[]) {
    if (!e.categorias) continue;
    mapa.set(e.consultor_id, [...(mapa.get(e.consultor_id) ?? []), e.categorias]);
  }
  return mapa;
}

async function fotosFirmadas(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, filas: Fila[]) {
  const rutas = filas.map((f) => f.foto_path).filter((r): r is string => Boolean(r));
  if (rutas.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from(BUCKET_FOTO).createSignedUrls(rutas, 900);
  return new Map((data ?? []).filter((f) => f.signedUrl && f.path).map((f) => [f.path as string, f.signedUrl]));
}

const normalizar = (t: string) =>
  t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * CU-20 · El directorio, ordenado por rating y, a igualdad, por encargos
 * completados. Los filtros son opcionales; una especialidad basta para
 * coincidir.
 */
export async function listarDirectorio(filtros: FiltrosDirectorio = {}): Promise<ConsultorDirectorio[]> {
  const { supabase, filas } = await filasDelDirectorio();
  const [especialidades, fotos] = await Promise.all([
    especialidadesDe(supabase, filas.map((f) => f.id)),
    fotosFirmadas(supabase, filas),
  ]);
  const q = filtros.q ? normalizar(filtros.q) : "";

  return filas
    .map((f) => ({
      id: f.id,
      nombreProfesional: f.nombre_profesional ?? "",
      fotoUrl: f.foto_path ? fotos.get(f.foto_path) ?? null : null,
      ratingPromedio: Number(f.rating_promedio),
      totalEncargosCompletados: f.total_encargos_completados,
      especialidades: especialidades.get(f.id) ?? [],
    }))
    .filter((c) => !q || normalizar(c.nombreProfesional).includes(q))
    .filter((c) => !filtros.especialidades?.length || c.especialidades.some((e) => filtros.especialidades!.includes(e.id)))
    .filter((c) => c.ratingPromedio >= (filtros.ratingMin ?? 0))
    .sort((a, b) => b.ratingPromedio - a.ratingPromedio || b.totalEncargosCompletados - a.totalEncargosCompletados);
}

/**
 * CU-21 · Perfil público. Si el consultor no está en el directorio (no
 * aprobado, suspendido o del equipo interno), null: la pantalla responde
 * "no encontrado". El contacto solo llega con un encargo en curso de la
 * empresa de la sesión (RF-80).
 */
export async function obtenerPerfilPublico(id: string): Promise<PerfilConsultorPublico | null> {
  const { supabase, filas } = await filasDelDirectorio([id]);
  const fila = filas[0];
  if (!fila) return null;

  const [especialidades, fotos, portafolio, resenas, contacto, redes] = await Promise.all([
    especialidadesDe(supabase, [id]),
    fotosFirmadas(supabase, [fila]),
    supabase
      .from("consultor_portafolio")
      .select("nombre_proyecto, entidad, anio, descripcion, resultado")
      .eq("consultor_id", id)
      .order("orden"),
    // Sin la empresa que calificó (docs/05 §9.22).
    supabase
      .from("calificaciones")
      .select("estrellas, comentario, creada_at")
      .eq("consultor_id", id)
      .order("creada_at", { ascending: false }),
    supabase.rpc("contacto_consultor", { p_consultor: id }).maybeSingle(),
    supabase.from("consultor_redes").select("tipo, url").eq("consultor_id", id),
  ]);
  for (const r of [portafolio, resenas, contacto, redes]) {
    if (r.error) console.error("Perfil público: no se pudo leer", r.error.code, r.error.message);
  }

  // contacto_consultor devuelve cero filas si la pareja no tiene un encargo
  // en curso: no distingue "no autorizado" de "no existe".
  const c = contacto.data as { sitio_web: string | null; cv_path: string | null } | null;

  return {
    id: fila.id,
    nombreProfesional: fila.nombre_profesional ?? "",
    fotoUrl: fila.foto_path ? fotos.get(fila.foto_path) ?? null : null,
    ratingPromedio: Number(fila.rating_promedio),
    totalEncargosCompletados: fila.total_encargos_completados,
    especialidades: especialidades.get(id) ?? [],
    descripcion: fila.descripcion ?? "",
    portafolio: (portafolio.data ?? []).map((p) => ({
      nombreProyecto: p.nombre_proyecto,
      entidad: p.entidad ?? "",
      anio: p.anio,
      descripcion: p.descripcion ?? "",
      resultado: p.resultado ?? "",
    })),
    resenas: (resenas.data ?? []).map((r) => ({ estrellas: r.estrellas, comentario: r.comentario, fecha: r.creada_at })),
    contacto: c
      ? {
          sitioWeb: c.sitio_web ?? "",
          redes: (redes.data ?? []).map((r) => ({ tipo: r.tipo as RedSocialTipo, url: r.url })),
          tieneHojaDeVida: Boolean(c.cv_path),
        }
      : null,
  };
}

/** Hoja de vida por URL firmada de 15 minutos, solo con encargo en curso (RF-80, RNF-16). */
export async function urlHojaDeVidaParaEmpresa(id: string): Promise<Resultado<{ url: string }>> {
  const noDisponible = { ok: false as const, status: 404, error: "La hoja de vida se muestra cuando el consultor acepta tu solicitud." };
  const { supabase, filas } = await filasDelDirectorio([id]);
  if (!filas[0]) return { ok: false, status: 404, error: "No encontramos este consultor." };
  const { data } = await supabase.rpc("contacto_consultor", { p_consultor: id }).maybeSingle();
  const ruta = (data as { cv_path: string | null } | null)?.cv_path;
  if (!ruta) return noDisponible;
  const nombre = `Hoja de vida - ${filas[0].nombre_profesional?.trim() || "consultor"}.pdf`;
  const firmada = await firmarDescarga(supabase, BUCKET_CV, ruta, nombre);
  if ("error" in firmada) {
    console.error("Perfil público: no se pudo firmar la hoja de vida", firmada.error);
    return noDisponible;
  }
  return { ok: true, datos: { url: firmada.url } };
}
