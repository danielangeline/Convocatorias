import "server-only";
import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerSesion } from "@/lib/auth";
import { fechaColombia } from "@/lib/fechas";
import type { EncargoDeBusqueda, EstadoPropuesta, PropuestaEncargo } from "@/lib/types";

/**
 * Búsqueda y propuestas de convocatorias en un encargo "buscar convocatoria"
 * (RF-91, RF-92, RF-93 · CU-18, CU-22 · docs/05 §9.25 · Sprint 5). Todo con la
 * sesión de quien pide: las funciones de la base comprueban la parte, el tipo
 * y el estado del encargo, con la fila bloqueada. Aquí se valida la forma y se
 * traduce cada clave de rechazo a su código HTTP.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;
type Cuerpo = Record<string, unknown> | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const NOTA_MAXIMA = 1000;

type FilaPropuesta = {
  id: string;
  convocatoria_id: string;
  nota: string;
  estado: EstadoPropuesta;
  creada_at: string;
  convocatoria_nombre: string;
  entidad: string;
  fecha_cierre: string;
  vigente: boolean;
  porcentaje: number | null;
};

/** RF-92, RF-93 · Las propuestas de un encargo, con la compatibilidad calculada ahora. */
export async function leerPropuestas(supabase: Cliente, encargoId: string): Promise<PropuestaEncargo[]> {
  const { data, error } = await supabase.rpc("propuestas_de_encargo", { p_encargo: encargoId });
  if (error) {
    console.error("Propuestas: no se pudieron leer", error.code, error.message);
    return [];
  }
  return ((data ?? []) as FilaPropuesta[]).map((f) => ({
    id: f.id,
    convocatoriaId: f.convocatoria_id,
    convocatoriaNombre: f.convocatoria_nombre,
    entidad: f.entidad,
    fechaCierre: f.fecha_cierre,
    vigente: f.vigente,
    porcentaje: f.porcentaje,
    nota: f.nota,
    estado: f.estado,
    creada: fechaColombia(f.creada_at),
  }));
}

/**
 * RF-91 · El encargo desde el que el consultor de la sesión busca: suyo, de
 * "buscar convocatoria" y en curso. Si no lo es, null y el llamador responde
 * 404: la RLS no sabe de encargos al abrir el catálogo (docs/05 §9.25), así
 * que esta es la barrera que ata cada búsqueda a un encargo concreto.
 */
export const encargoDeBusqueda = cache(async (id: string): Promise<EncargoDeBusqueda | null> => {
  if (!UUID.test(id)) return null;
  const sesion = await obtenerSesion();
  if (!sesion) return null;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("encargos")
    .select("id, proyecto_id, titulo_tarea, descripcion_tarea, convocatoria_id")
    .eq("id", id)
    .eq("consultor_id", sesion.sesion.usuarioId)
    .eq("tipo_ayuda", "buscar_convocatoria")
    .eq("estado", "en_curso")
    .maybeSingle();
  if (error) console.error("Propuestas: no se pudo leer el encargo", error.code, error.message);
  if (!data) return null;

  const [{ data: datos }, propuestas] = await Promise.all([
    supabase.rpc("datos_de_mis_encargos"),
    leerPropuestas(supabase, id),
  ]);
  const fila = ((datos ?? []) as { encargo_id: string; proyecto_nombre: string; empresa_nombre: string | null }[]).find(
    (d) => d.encargo_id === id
  );
  return {
    id: data.id,
    proyectoId: data.proyecto_id,
    tituloTarea: data.titulo_tarea,
    descripcionTarea: data.descripcion_tarea ?? "",
    proyectoNombre: fila?.proyecto_nombre ?? "Proyecto",
    empresaNombre: fila?.empresa_nombre ?? "Empresa",
    convocatoriaId: data.convocatoria_id,
    propuestas,
  };
});

// ---------------------------------------------------------------------------
// Rechazos de la base → HTTP
// ---------------------------------------------------------------------------

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_existe: { status: 404, error: "No encontrado." },
  encargo_no_admite_propuestas: {
    status: 409,
    error: "Este encargo ya no admite propuestas: la empresa ya eligió una convocatoria o el encargo terminó.",
  },
  convocatoria_no_vigente: {
    status: 409,
    error: "Esa convocatoria ya no está abierta: cerró o se despublicó.",
  },
  ya_propuesta: { status: 409, error: "Ya propusiste esta convocatoria en este encargo." },
  nota_invalida: { status: 400, error: `Escribe por qué le sirve al proyecto (hasta ${NOTA_MAXIMA.toLocaleString("es-CO")} caracteres).` },
  estado_no_permite: { status: 409, error: "La propuesta o el encargo cambiaron: recarga la página para ver cómo quedaron." },
  ya_elegida: { status: 409, error: "Ya elegiste una convocatoria para este encargo; la elección no se cambia." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Propuestas: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Escrituras
// ---------------------------------------------------------------------------

/** RF-92 · { convocatoriaId, nota }: el consultor propone una convocatoria vigente. */
export async function proponerConvocatoria(encargoId: string, cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  if (!UUID.test(encargoId)) return { ok: false, ...RECHAZOS.no_existe };
  const convocatoriaId = cuerpo?.convocatoriaId;
  const nota = typeof cuerpo?.nota === "string" ? cuerpo.nota.trim() : "";
  if (typeof convocatoriaId !== "string" || !UUID.test(convocatoriaId)) {
    return { ok: false, status: 400, error: "Elige la convocatoria que propones." };
  }
  if (!nota || nota.length > NOTA_MAXIMA) return { ok: false, ...RECHAZOS.nota_invalida };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("proponer_convocatoria", {
    p_encargo: encargoId,
    p_convocatoria: convocatoriaId,
    p_nota: nota,
  });
  if (error) return rechazo(error, "proponer");
  return { ok: true, datos: { id: data as string } };
}

/** RF-92 · El consultor retira una propuesta que la empresa no ha elegido. */
export async function retirarPropuesta(id: string): Promise<Resultado<null>> {
  if (!UUID.test(id)) return { ok: false, ...RECHAZOS.no_existe };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("retirar_propuesta", { p_propuesta: id });
  if (error) return rechazo(error, "retirar la propuesta");
  return { ok: true, datos: null };
}

/**
 * RF-93 · La empresa elige una propuesta del encargo: queda como su
 * convocatoria y el encargo sigue. Comprueba que la propuesta sea de ese
 * encargo para que la ruta no mienta; la base comprueba lo demás.
 */
export async function elegirPropuesta(encargoId: string, propuestaId: string): Promise<Resultado<{ convocatoriaId: string }>> {
  if (!UUID.test(encargoId) || !UUID.test(propuestaId)) return { ok: false, ...RECHAZOS.no_existe };
  const supabase = await crearClienteServidor();
  const { data: propuesta } = await supabase
    .from("encargo_propuestas")
    .select("id")
    .eq("id", propuestaId)
    .eq("encargo_id", encargoId)
    .maybeSingle();
  if (!propuesta) return { ok: false, ...RECHAZOS.no_existe };
  const { data, error } = await supabase.rpc("elegir_propuesta", { p_propuesta: propuestaId });
  if (error) return rechazo(error, "elegir la propuesta");
  return { ok: true, datos: { convocatoriaId: data as string } };
}

/** RF-92 · Las propuestas de un encargo propio, para la empresa (GET). */
export async function propuestasDeEncargo(encargoId: string): Promise<Resultado<PropuestaEncargo[]>> {
  if (!UUID.test(encargoId)) return { ok: false, ...RECHAZOS.no_existe };
  const sesion = await obtenerSesion();
  if (!sesion) return { ok: false, ...RECHAZOS.no_existe };
  const supabase = await crearClienteServidor();
  const { data: encargo } = await supabase
    .from("encargos")
    .select("id")
    .eq("id", encargoId)
    .eq("empresa_id", sesion.sesion.usuarioId)
    .maybeSingle();
  if (!encargo) return { ok: false, ...RECHAZOS.no_existe };
  return { ok: true, datos: await leerPropuestas(supabase, encargoId) };
}
