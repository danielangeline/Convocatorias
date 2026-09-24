import "server-only";
import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { fechaColombia } from "@/lib/fechas";
import { COLUMNAS_CONVOCATORIA, aConvocatoria, type FilaConvocatoria } from "@/lib/catalogo";
import { ESTADOS_POSTULACION_TERMINALES, transicionPermitida } from "@/lib/utils";
import type { ChecklistItem, EstadoPostulacion, Postulacion, PostulacionConConvocatoria } from "@/lib/types";

/**
 * Postulaciones de la empresa (RF-17, RF-18, RF-19, RF-83, RN-04, RN-35 ·
 * CU-11, CU-12, CU-13 · docs/05 §9.19 · Sprint 3 pasos 3 y 4). Todo con la
 * sesión de la empresa: **la RLS decide qué postulación es suya** (RN-30). Las
 * reglas viven en la base —`iniciar_postulacion`, el índice de un par en
 * curso, los triggers del proyecto fijo, del checklist cerrado y del grafo—;
 * aquí se valida la forma y se traduce cada clave a su código HTTP.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS: EstadoPostulacion[] = ["en_preparacion", "presentada", "en_evaluacion", "aprobada", "rechazada", "cerrada"];

const COLUMNAS = `id, usuario_id, convocatoria_id, proyecto_id, estado, creada_at,
  postulacion_checklist (id, descripcion, obligatorio, orden, completado),
  postulacion_historial (id, estado_anterior, estado_nuevo, fecha),
  convocatorias (${COLUMNAS_CONVOCATORIA})`;

type Fila = {
  id: string;
  usuario_id: string;
  convocatoria_id: string;
  proyecto_id: string | null;
  estado: EstadoPostulacion;
  creada_at: string;
  postulacion_checklist: { id: string; descripcion: string; obligatorio: boolean; orden: number; completado: boolean }[];
  postulacion_historial: { id: string; estado_anterior: EstadoPostulacion | null; estado_nuevo: EstadoPostulacion; fecha: string }[];
  convocatorias: FilaConvocatoria | null;
};

function aPostulacion(f: Fila): PostulacionConConvocatoria {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    convocatoriaId: f.convocatoria_id,
    proyectoId: f.proyecto_id,
    estado: f.estado,
    creadaAt: f.creada_at,
    checklist: [...f.postulacion_checklist]
      .sort((a, b) => a.orden - b.orden)
      .map(({ id, descripcion, obligatorio, completado }) => ({ id, descripcion, obligatorio, completado })),
    historial: [...f.postulacion_historial]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((h) => ({ id: h.id, estadoAnterior: h.estado_anterior, estadoNuevo: h.estado_nuevo, fecha: fechaColombia(h.fecha) })),
    convocatoria: f.convocatorias ? aConvocatoria(f.convocatorias) : null,
  };
}

/** La postulación sin su convocatoria, para el store (SincronizarPostulaciones). */
export function sinConvocatoria(p: PostulacionConConvocatoria): Postulacion {
  const { id, usuarioId, convocatoriaId, proyectoId, estado, checklist, historial } = p;
  return { id, usuarioId, convocatoriaId, proyectoId, estado, checklist, historial };
}

// `cache` de React: el layout y la página piden lo mismo en una petición.

/** RN-30 · Las postulaciones de la sesión, las más recientes primero. */
export const listarPostulaciones = cache(async (): Promise<PostulacionConConvocatoria[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("postulaciones").select(COLUMNAS).order("creada_at", { ascending: false });
  if (error) {
    console.error("Postulaciones: no se pudieron listar", error.code, error.message);
    return [];
  }
  return (data as unknown as Fila[]).map(aPostulacion);
});

/** La postulación, si la sesión puede verla; null si para ella no existe. */
export const obtenerPostulacion = cache(async (id: string): Promise<PostulacionConConvocatoria | null> => {
  if (!UUID.test(id)) return null;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("postulaciones").select(COLUMNAS).eq("id", id).maybeSingle();
  if (error) console.error("Postulaciones: no se pudo leer", error.code, error.message);
  return data ? aPostulacion(data as unknown as Fila) : null;
});

// ---------------------------------------------------------------------------
// Rechazos de la base → HTTP
// ---------------------------------------------------------------------------

const RECHAZOS: Record<string, { status: number; error: string }> = {
  sin_suscripcion: { status: 402, error: "Necesitas una suscripción vigente para postular." },
  no_es_empresa: { status: 403, error: "Solo una cuenta de empresa puede postular." },
  convocatoria_no_existe: { status: 404, error: "La convocatoria no existe." },
  proyecto_no_existe: { status: 404, error: "El proyecto no existe." },
  convocatoria_no_vigente: {
    status: 409,
    error: "Esta convocatoria ya no está abierta: está cerrada o despublicada y no admite nuevas postulaciones.",
  },
  proyecto_fijo: { status: 409, error: "Esta postulación ya tiene un proyecto vinculado y no se puede cambiar." },
  postulacion_cerrada: { status: 409, error: "La postulación está cerrada: su checklist ya no se puede modificar." },
  transicion_invalida: { status: 409, error: "Ese cambio de estado no está permitido desde el estado actual." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  if (error.code === "23505") {
    return {
      ok: false,
      status: 409,
      error: "Ese proyecto ya tiene una postulación en curso en esta convocatoria. Ábrela desde Mis postulaciones.",
    };
  }
  console.error(`Postulaciones: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

type Cuerpo = Record<string, unknown> | null;

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

/**
 * RF-17, CU-11 · Inicia una postulación, o devuelve la que ya está en curso
 * para ese par proyecto-convocatoria (CU-11 1c, RN-35). `creada` dice cuál.
 */
export async function iniciarPostulacion(cuerpo: Cuerpo): Promise<Resultado<{ id: string; creada: boolean }>> {
  const convocatoriaId = cuerpo?.convocatoriaId;
  const proyectoId = cuerpo?.proyectoId ?? null;
  if (typeof convocatoriaId !== "string" || !UUID.test(convocatoriaId)) {
    return { ok: false, status: 400, error: "Falta la convocatoria." };
  }
  if (proyectoId !== null && (typeof proyectoId !== "string" || !UUID.test(proyectoId))) {
    return { ok: false, status: 400, error: "Proyecto no válido." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .rpc("iniciar_postulacion", { p_convocatoria: convocatoriaId, p_proyecto: proyectoId })
    .single<{ id: string; creada: boolean }>();
  if (error) return rechazo(error, "iniciar");
  return { ok: true, datos: data };
}

/** CU-13 3a/5a, RN-35 · Vincula un proyecto a una postulación que no tiene. */
export async function vincularProyecto(id: string, cuerpo: Cuerpo): Promise<Resultado<PostulacionConConvocatoria>> {
  const proyectoId = cuerpo?.proyectoId;
  if (typeof proyectoId !== "string" || !UUID.test(proyectoId)) {
    return { ok: false, status: 400, error: "Elige un proyecto." };
  }
  const postulacion = await obtenerPostulacion(id);
  if (!postulacion) return { ok: false, status: 404, error: "La postulación no existe." };
  if (postulacion.proyectoId === proyectoId) return { ok: true, datos: postulacion };
  if (postulacion.proyectoId) return { ok: false, ...RECHAZOS.proyecto_fijo };

  const supabase = await crearClienteServidor();
  // La RLS no deja vincular un proyecto ajeno; se pregunta antes para responder 404.
  const { data: proyecto } = await supabase.from("proyectos").select("id").eq("id", proyectoId).maybeSingle();
  if (!proyecto) return { ok: false, ...RECHAZOS.proyecto_no_existe };

  const { error } = await supabase.from("postulaciones").update({ proyecto_id: proyectoId }).eq("id", id);
  if (error) return rechazo(error, "vincular");
  return releer(id);
}

/** RF-18, CU-12 · Marca o desmarca un ítem del checklist propio. */
export async function marcarItem(itemId: string, cuerpo: Cuerpo): Promise<Resultado<ChecklistItem>> {
  if (!UUID.test(itemId)) return { ok: false, status: 404, error: "El ítem no existe." };
  const completado = cuerpo?.completado;
  if (typeof completado !== "boolean") return { ok: false, status: 400, error: "Indica si el ítem está completado." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("postulacion_checklist")
    .update({ completado })
    .eq("id", itemId)
    .select("id, descripcion, obligatorio, completado")
    .maybeSingle();
  if (error) return rechazo(error, "marcar el checklist");
  if (!data) return { ok: false, status: 404, error: "El ítem no existe." };
  return { ok: true, datos: data as ChecklistItem };
}

/**
 * RF-19, RF-83, CU-13 · Cambia el estado siguiendo el grafo. La base es la
 * barrera (trigger); aquí se rechaza antes para dar el motivo, y una transición
 * terminal exige `confirmado: true`, que la pantalla envía tras su diálogo.
 */
export async function cambiarEstado(id: string, cuerpo: Cuerpo): Promise<Resultado<PostulacionConConvocatoria>> {
  const estado = cuerpo?.estado;
  if (typeof estado !== "string" || !ESTADOS.includes(estado as EstadoPostulacion)) {
    return { ok: false, status: 400, error: "Estado no válido." };
  }
  const nuevo = estado as EstadoPostulacion;
  const postulacion = await obtenerPostulacion(id);
  if (!postulacion) return { ok: false, status: 404, error: "La postulación no existe." };
  if (postulacion.estado === nuevo) return { ok: true, datos: postulacion };
  if (!transicionPermitida(postulacion.estado, nuevo)) return { ok: false, ...RECHAZOS.transicion_invalida };
  if (ESTADOS_POSTULACION_TERMINALES.includes(nuevo) && cuerpo?.confirmado !== true) {
    return { ok: false, status: 400, error: "Confirma el cierre de la postulación: no se podrá reabrir." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("postulaciones").update({ estado: nuevo }).eq("id", id);
  if (error) return rechazo(error, "cambiar el estado");
  return releer(id);
}

async function releer(id: string): Promise<Resultado<PostulacionConConvocatoria>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("postulaciones").select(COLUMNAS).eq("id", id).maybeSingle();
  if (error || !data) return { ok: false, status: 404, error: "La postulación no existe." };
  return { ok: true, datos: aPostulacion(data as unknown as Fila) };
}
