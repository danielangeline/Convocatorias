import "server-only";
import { cache } from "react";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BUCKET_FOTO } from "@/lib/consultor-perfil-servidor";
import { COLUMNAS_PROYECTO, aProyecto, type FilaProyecto } from "@/lib/proyectos-servidor";
import { fechaColombia } from "@/lib/fechas";
import { leerPropuestas } from "@/lib/propuestas-servidor";
import type {
  ContextoEncargo,
  Encargo,
  EncargoConsultor,
  EncargoDetalle,
  EstadoEncargo,
  PropuestaEncargo,
  Proyecto,
  SolicitudEquipo,
  TipoAyudaEncargo,
  ViaEncargo,
} from "@/lib/types";

/**
 * Encargos de punta a punta (RF-28..33, RF-68..70, RF-74, RF-89, RF-90 ·
 * CU-18, 19, 22, 23, 24, 26 · docs/05 §9.23 · Sprint 4 paso 3). Todo con la
 * sesión del usuario: la RLS decide qué encargo existe para él y las funciones
 * de la base comprueban la parte y el estado de origen de cada acción. Aquí se
 * valida la forma y se traduce cada clave de rechazo a su código HTTP.
 */

type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };
type Cliente = Awaited<ReturnType<typeof crearClienteServidor>>;
type Cuerpo = Record<string, unknown> | null;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sin `nota_interna` ni `atendido_por`: no tienen permiso de lectura por columna.
const COLUMNAS = `id, proyecto_id, empresa_id, consultor_id, titulo_tarea, descripcion_tarea, via, estado,
  tipo_ayuda, convocatoria_id, postulacion_id, motivo_cancelacion, creada_at, aceptado_at, completado_at, atendido_at,
  encargo_avances (id, nota, fecha),
  calificaciones (estrellas, comentario, creada_at),
  consultor_perfiles (id, nombre_profesional, foto_path)`;

type Fila = {
  id: string;
  proyecto_id: string;
  empresa_id: string;
  consultor_id: string | null;
  titulo_tarea: string;
  descripcion_tarea: string | null;
  via: ViaEncargo;
  estado: EstadoEncargo;
  tipo_ayuda: TipoAyudaEncargo;
  convocatoria_id: string | null;
  postulacion_id: string | null;
  motivo_cancelacion: string | null;
  creada_at: string;
  aceptado_at: string | null;
  completado_at: string | null;
  atendido_at: string | null;
  encargo_avances: { id: string; nota: string; fecha: string }[];
  // Una calificación por encargo: PostgREST la entrega como objeto o lista.
  calificaciones:
    | { estrellas: number; comentario: string | null; creada_at: string }
    | { estrellas: number; comentario: string | null; creada_at: string }[]
    | null;
  consultor_perfiles: { id: string; nombre_profesional: string | null; foto_path: string | null } | null;
};

type Datos = {
  encargo_id: string;
  proyecto_nombre: string;
  convocatoria_nombre: string | null;
  empresa_nombre: string | null;
  correo_contraparte: string | null;
};

const fecha = (instante: string | null) => (instante ? fechaColombia(instante) : null);

function aEncargo(f: Fila, datos: Datos | undefined, fotos: Map<string, string>, propuestas: PropuestaEncargo[]): EncargoDetalle {
  const calificacion = Array.isArray(f.calificaciones) ? f.calificaciones[0] : f.calificaciones;
  const cp = f.consultor_perfiles;
  return {
    id: f.id,
    proyectoId: f.proyecto_id,
    empresaId: f.empresa_id,
    consultorId: f.consultor_id,
    tituloTarea: f.titulo_tarea,
    descripcionTarea: f.descripcion_tarea ?? "",
    via: f.via,
    estado: f.estado,
    motivoCancelacion: f.motivo_cancelacion ?? undefined,
    avances: [...f.encargo_avances]
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .map((a) => ({ id: a.id, nota: a.nota, fecha: fechaColombia(a.fecha) })),
    fechas: { creada: fechaColombia(f.creada_at), aceptado: fecha(f.aceptado_at), completado: fecha(f.completado_at) },
    tipoAyuda: f.tipo_ayuda,
    convocatoriaId: f.convocatoria_id,
    postulacionId: f.postulacion_id,
    proyectoNombre: datos?.proyecto_nombre ?? "Proyecto",
    convocatoriaNombre: datos?.convocatoria_nombre ?? null,
    empresaNombre: datos?.empresa_nombre ?? "Empresa",
    correoContraparte: datos?.correo_contraparte ?? null,
    atendidoAt: fecha(f.atendido_at),
    consultor: cp
      ? { id: cp.id, nombre: cp.nombre_profesional ?? "Consultor", fotoUrl: cp.foto_path ? fotos.get(cp.foto_path) ?? null : null }
      : null,
    calificacion: calificacion
      ? { estrellas: calificacion.estrellas, comentario: calificacion.comentario, fecha: fechaColombia(calificacion.creada_at) }
      : null,
    propuestas,
  };
}

async function fotosFirmadas(supabase: Cliente, filas: Fila[]) {
  const rutas = [...new Set(filas.map((f) => f.consultor_perfiles?.foto_path).filter((r): r is string => Boolean(r)))];
  if (rutas.length === 0) return new Map<string, string>();
  // La base solo firma la foto vigente de un aprobado (docs/05 §9.22).
  const { data } = await supabase.storage.from(BUCKET_FOTO).createSignedUrls(rutas, 900);
  return new Map((data ?? []).filter((f) => f.signedUrl && f.path).map((f) => [f.path as string, f.signedUrl as string]));
}

async function leerEncargos(supabase: Cliente, conFotos: boolean): Promise<EncargoDetalle[]> {
  const [{ data, error }, { data: datos, error: errorDatos }] = await Promise.all([
    supabase.from("encargos").select(COLUMNAS).order("creada_at", { ascending: false }),
    supabase.rpc("datos_de_mis_encargos"),
  ]);
  if (error) console.error("Encargos: no se pudieron listar", error.code, error.message);
  if (errorDatos) console.error("Encargos: no se pudieron leer los datos", errorDatos.code, errorDatos.message);
  const filas = (data ?? []) as unknown as Fila[];
  const porId = new Map(((datos ?? []) as Datos[]).map((d) => [d.encargo_id, d]));
  // RF-92, RF-93: las propuestas, solo en los de búsqueda que llegaron a aceptarse.
  const deBusqueda = filas.filter((f) => f.tipo_ayuda === "buscar_convocatoria" && f.aceptado_at);
  const [fotos, propuestas] = await Promise.all([
    conFotos ? fotosFirmadas(supabase, filas) : Promise.resolve(new Map<string, string>()),
    Promise.all(deBusqueda.map((f) => leerPropuestas(supabase, f.id))),
  ]);
  const propuestasPorId = new Map(deBusqueda.map((f, i) => [f.id, propuestas[i]]));
  return filas.map((f) => aEncargo(f, porId.get(f.id), fotos, propuestasPorId.get(f.id) ?? []));
}

// `cache` de React: el layout y la página piden lo mismo en una petición.

/** RN-30 · Los encargos de la empresa de la sesión, con su consultor. */
export const listarEncargosEmpresa = cache(async (): Promise<EncargoDetalle[]> => {
  const supabase = await crearClienteServidor();
  return leerEncargos(supabase, true);
});

async function nombresDeCategorias(supabase: Cliente, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("categorias").select("id, nombre").in("id", ids);
  return new Map(((data ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]));
}

async function proyectosConCategorias(supabase: Cliente, ids: string[]) {
  const mapa = new Map<string, Proyecto & { categoriasNombres: string[] }>();
  if (ids.length === 0) return mapa;
  const { data, error } = await supabase.from("proyectos").select(COLUMNAS_PROYECTO).in("id", ids);
  if (error) console.error("Encargos: no se pudieron leer los proyectos", error.code, error.message);
  const proyectos = ((data ?? []) as unknown as FilaProyecto[]).map(aProyecto);
  const nombres = await nombresDeCategorias(supabase, [...new Set(proyectos.flatMap((p) => p.categorias))]);
  for (const p of proyectos) {
    mapa.set(p.id, { ...p, categoriasNombres: p.categorias.map((c) => nombres.get(c)).filter((n): n is string => Boolean(n)) });
  }
  return mapa;
}

/**
 * RN-25, RF-68, RF-69 · Los encargos del consultor, con el contexto que la base
 * le deja leer mientras el encargo está pendiente o en curso: el proyecto, la
 * convocatoria con sus requisitos y el checklist de la postulación vinculada.
 */
export const listarEncargosConsultor = cache(async (): Promise<EncargoConsultor[]> => {
  const supabase = await crearClienteServidor();
  const encargos = await leerEncargos(supabase, false);
  const vivos = encargos.filter((e) => e.estado === "pendiente" || e.estado === "en_curso");

  const idsConvocatoria = [...new Set(vivos.map((e) => e.convocatoriaId).filter((c): c is string => Boolean(c)))];
  const idsPostulacion = [...new Set(vivos.map((e) => e.postulacionId).filter((p): p is string => Boolean(p)))];
  const [proyectos, convocatorias, checklist] = await Promise.all([
    proyectosConCategorias(supabase, [...new Set(vivos.map((e) => e.proyectoId))]),
    idsConvocatoria.length
      ? supabase
          .from("convocatorias")
          .select("id, nombre, entidad_convocante, fecha_cierre, url_postulacion, requisitos_convocatoria (descripcion, obligatorio, orden)")
          .in("id", idsConvocatoria)
      : Promise.resolve({ data: [] }),
    idsPostulacion.length
      ? supabase
          .from("postulacion_checklist")
          .select("postulacion_id, descripcion, obligatorio, completado, orden")
          .in("postulacion_id", idsPostulacion)
      : Promise.resolve({ data: [] }),
  ]);

  type FilaConv = {
    id: string;
    nombre: string;
    entidad_convocante: string;
    fecha_cierre: string;
    url_postulacion: string | null;
    requisitos_convocatoria: { descripcion: string; obligatorio: boolean; orden: number }[];
  };
  const convPorId = new Map(((convocatorias.data ?? []) as FilaConv[]).map((c) => [c.id, c]));
  type FilaItem = { postulacion_id: string; descripcion: string; obligatorio: boolean; completado: boolean; orden: number };
  const itemsPorPostulacion = new Map<string, FilaItem[]>();
  for (const i of (checklist.data ?? []) as FilaItem[]) {
    itemsPorPostulacion.set(i.postulacion_id, [...(itemsPorPostulacion.get(i.postulacion_id) ?? []), i]);
  }

  return encargos.map((e) => {
    const proyecto = proyectos.get(e.proyectoId);
    const conv = e.convocatoriaId ? convPorId.get(e.convocatoriaId) : undefined;
    const items = e.postulacionId ? itemsPorPostulacion.get(e.postulacionId) : undefined;
    const contexto: ContextoEncargo | null = proyecto
      ? {
          proyecto,
          convocatoria: conv
            ? {
                id: conv.id,
                nombre: conv.nombre,
                entidad: conv.entidad_convocante,
                fechaCierre: conv.fecha_cierre,
                urlPostulacion: conv.url_postulacion,
                requisitos: [...conv.requisitos_convocatoria]
                  .sort((a, b) => a.orden - b.orden)
                  .map(({ descripcion, obligatorio }) => ({ descripcion, obligatorio })),
              }
            : null,
          checklist: items
            ? [...items].sort((a, b) => a.orden - b.orden).map(({ descripcion, obligatorio, completado }) => ({ descripcion, obligatorio, completado }))
            : null,
        }
      : null;
    return { ...e, contexto };
  });
});

/** El encargo sin lo que solo usa la pantalla de encargos, para el store (SincronizarEncargos). */
export function aEncargoBase(e: EncargoDetalle): Encargo {
  const { id, proyectoId, empresaId, consultorId, tituloTarea, descripcionTarea, via, estado, motivoCancelacion, avances, fechas, tipoAyuda, convocatoriaId, postulacionId } = e;
  return { id, proyectoId, empresaId, consultorId, tituloTarea, descripcionTarea, via, estado, motivoCancelacion, avances, fechas, tipoAyuda, convocatoriaId, postulacionId };
}

// ---------------------------------------------------------------------------
// Panel: solicitudes al equipo (RF-90)
// ---------------------------------------------------------------------------

type FilaSolicitud = {
  id: string;
  proyecto_id: string;
  empresa_nombre: string | null;
  empresa_contacto: string | null;
  empresa_correo: string;
  titulo_tarea: string;
  descripcion_tarea: string | null;
  tipo_ayuda: TipoAyudaEncargo;
  convocatoria_id: string | null;
  creada_at: string;
  atendido_at: string | null;
  atendido_por_nombre: string | null;
  nota_interna: string | null;
};

export type EstadoSolicitudEquipo = "esperando_asignacion" | "atendido";

/** RF-90, CU-26 · Las solicitudes al equipo en un estado, con el contexto del proyecto. */
export async function listarSolicitudesEquipo(estado: EstadoSolicitudEquipo): Promise<SolicitudEquipo[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("solicitudes_equipo", { p_estado: estado });
  if (error) {
    console.error("Solicitudes al equipo: no se pudieron listar", error.code, error.message);
    return [];
  }
  const filas = (data ?? []) as FilaSolicitud[];
  const idsConvocatoria = [...new Set(filas.map((f) => f.convocatoria_id).filter((c): c is string => Boolean(c)))];
  const [proyectos, convocatorias] = await Promise.all([
    proyectosConCategorias(supabase, [...new Set(filas.map((f) => f.proyecto_id))]),
    idsConvocatoria.length
      ? supabase.from("convocatorias").select("id, nombre").in("id", idsConvocatoria)
      : Promise.resolve({ data: [] }),
  ]);
  const convPorId = new Map(((convocatorias.data ?? []) as { id: string; nombre: string }[]).map((c) => [c.id, c.nombre]));

  return filas.map((f) => ({
    id: f.id,
    proyectoId: f.proyecto_id,
    empresaNombre: f.empresa_nombre ?? "Empresa",
    empresaContacto: f.empresa_contacto ?? "",
    empresaCorreo: f.empresa_correo,
    tituloTarea: f.titulo_tarea,
    descripcionTarea: f.descripcion_tarea ?? "",
    tipoAyuda: f.tipo_ayuda,
    convocatoriaId: f.convocatoria_id,
    convocatoriaNombre: f.convocatoria_id ? convPorId.get(f.convocatoria_id) ?? null : null,
    creadaAt: f.creada_at,
    atendidoAt: f.atendido_at,
    atendidoPorNombre: f.atendido_por_nombre,
    notaInterna: f.nota_interna,
    proyecto: proyectos.get(f.proyecto_id) ?? null,
  }));
}

/** RF-90 · Cuántas solicitudes esperan al equipo, para el menú y el dashboard del panel. */
export async function contarSolicitudesEquipo(): Promise<number> {
  const supabase = await crearClienteServidor();
  const { count, error } = await supabase
    .from("encargos")
    .select("id", { count: "exact", head: true })
    .eq("estado", "esperando_asignacion");
  if (error) console.error("Solicitudes al equipo: no se pudieron contar", error.code, error.message);
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Rechazos de la base → HTTP
// ---------------------------------------------------------------------------

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_empresa: { status: 403, error: "Solo una cuenta de empresa puede solicitar consultores." },
  sin_suscripcion: { status: 402, error: "Necesitas una suscripción vigente para solicitar un consultor." },
  proyecto_no_existe: { status: 404, error: "El proyecto no existe." },
  titulo_vacio: { status: 400, error: "Escribe el título de la tarea." },
  tipo_ayuda_invalido: { status: 400, error: "Elige el tipo de ayuda." },
  falta_convocatoria: { status: 400, error: "Elige la convocatoria con la que necesitas ayuda." },
  convocatoria_no_vigente: {
    status: 409,
    error: "Esa convocatoria ya no está abierta: está cerrada o despublicada. Elige otra o pide ayuda para buscar una.",
  },
  consultor_no_disponible: { status: 409, error: "Este consultor ya no está disponible en el directorio." },
  ya_solicitado: {
    status: 409,
    error: "Ya tienes una solicitud abierta con este consultor para este proyecto. Mírala en Mis encargos.",
  },
  ya_solicitado_equipo: {
    status: 409,
    error: "Ya enviaste una solicitud a nuestro equipo para este proyecto. Te contactaremos por correo.",
  },
  no_existe: { status: 404, error: "El encargo no existe." },
  estado_no_permite: { status: 409, error: "El encargo cambió de estado: recarga la página para ver cómo quedó." },
  respuesta_invalida: { status: 400, error: "Indica si aceptas la solicitud." },
  perfil_no_aprobado: { status: 409, error: "Tu perfil debe estar aprobado para aceptar solicitudes." },
  nota_vacia: { status: 400, error: "Escribe la nota de avance." },
  nota_larga: { status: 400, error: "La nota admite hasta 2.000 caracteres." },
  ya_calificado: { status: 409, error: "Este encargo ya tiene calificación." },
  estrellas_invalidas: { status: 400, error: "Elige de 1 a 5 estrellas." },
  comentario_largo: { status: 400, error: "El comentario admite hasta 1.000 caracteres." },
  no_autorizado: { status: 404, error: "No encontrado." },
};

function rechazo(error: PostgrestError, accion: string): { ok: false; status: number; error: string } {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  console.error(`Encargos: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

const texto = (v: unknown) => (typeof v === "string" ? v : null);

// ---------------------------------------------------------------------------
// Escrituras de la empresa
// ---------------------------------------------------------------------------

/**
 * CU-19, CU-22, CU-23, RF-28, RF-74 · Crea la solicitud: con `consultorId`, al
 * directorio (`pendiente`); sin él, al equipo (`esperando_asignacion`).
 */
export async function solicitarEncargo(cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const proyectoId = cuerpo?.proyectoId;
  const consultorId = cuerpo?.consultorId ?? null;
  const convocatoriaId = cuerpo?.convocatoriaId ?? null;
  const tipoAyuda = cuerpo?.tipoAyuda;
  const titulo = texto(cuerpo?.titulo)?.trim() ?? "";
  const descripcion = texto(cuerpo?.descripcion)?.trim() ?? "";

  if (typeof proyectoId !== "string" || !UUID.test(proyectoId)) return { ok: false, status: 400, error: "Elige un proyecto." };
  if (consultorId !== null && (typeof consultorId !== "string" || !UUID.test(consultorId))) {
    return { ok: false, status: 400, error: "Consultor no válido." };
  }
  if (tipoAyuda !== "convocatoria_especifica" && tipoAyuda !== "buscar_convocatoria") return { ok: false, ...RECHAZOS.tipo_ayuda_invalido };
  if (tipoAyuda === "convocatoria_especifica" && (typeof convocatoriaId !== "string" || !UUID.test(convocatoriaId))) {
    return { ok: false, ...RECHAZOS.falta_convocatoria };
  }
  if (!titulo) return { ok: false, ...RECHAZOS.titulo_vacio };
  if (titulo.length > 200) return { ok: false, status: 400, error: "El título admite hasta 200 caracteres." };
  if (descripcion.length > 4000) return { ok: false, status: 400, error: "La descripción admite hasta 4.000 caracteres." };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("solicitar_encargo", {
    p_proyecto: proyectoId,
    p_consultor: consultorId,
    p_titulo: titulo,
    p_descripcion: descripcion || null,
    p_tipo_ayuda: tipoAyuda,
    p_convocatoria: tipoAyuda === "convocatoria_especifica" ? convocatoriaId : null,
  });
  if (error) return rechazo(error, "solicitar");
  return { ok: true, datos: { id: data as string } };
}

async function accion(nombre: string, funcion: string, args: Record<string, unknown>): Promise<Resultado<null>> {
  if (typeof args.p_id !== "string" || !UUID.test(args.p_id)) return { ok: false, ...RECHAZOS.no_existe };
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc(funcion, args);
  if (error) return rechazo(error, nombre);
  return { ok: true, datos: null };
}

/** RF-89 · Retira una solicitud sin responder. */
export const retirarEncargo = (id: string) => accion("retirar", "retirar_encargo", { p_id: id });

/** RF-33, RN-09, CU-24 · Califica una vez un encargo completado. */
export async function calificarEncargo(id: string, cuerpo: Cuerpo): Promise<Resultado<null>> {
  const estrellas = cuerpo?.estrellas;
  const comentario = texto(cuerpo?.comentario)?.trim() ?? "";
  if (typeof estrellas !== "number" || !Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5) {
    return { ok: false, ...RECHAZOS.estrellas_invalidas };
  }
  if (comentario.length > 1000) return { ok: false, ...RECHAZOS.comentario_largo };
  return accion("calificar", "calificar_encargo", { p_id: id, p_estrellas: estrellas, p_comentario: comentario || null });
}

// ---------------------------------------------------------------------------
// Escrituras del consultor
// ---------------------------------------------------------------------------

/** RF-30, CU-18 · Acepta (revela el correo, RF-70) o rechaza. */
export async function responderEncargo(id: string, cuerpo: Cuerpo): Promise<Resultado<null>> {
  const acepta = cuerpo?.acepta;
  if (typeof acepta !== "boolean") return { ok: false, ...RECHAZOS.respuesta_invalida };
  return accion("responder", "responder_encargo", { p_id: id, p_acepta: acepta });
}

/** RF-32 · Nota de avance en un encargo en curso. */
export async function registrarAvance(id: string, cuerpo: Cuerpo): Promise<Resultado<null>> {
  const nota = texto(cuerpo?.nota)?.trim() ?? "";
  if (!nota) return { ok: false, ...RECHAZOS.nota_vacia };
  if (nota.length > 2000) return { ok: false, ...RECHAZOS.nota_larga };
  return accion("registrar el avance", "registrar_avance", { p_id: id, p_nota: nota });
}

/** RF-32, RF-33 · Marca la finalización. */
export const completarEncargo = (id: string) => accion("completar", "completar_encargo", { p_id: id });

// ---------------------------------------------------------------------------
// Escrituras del panel
// ---------------------------------------------------------------------------

/** RF-90, CU-26 · Marca como contactada una solicitud al equipo. */
export async function atenderSolicitud(id: string, cuerpo: Cuerpo): Promise<Resultado<null>> {
  const nota = texto(cuerpo?.nota)?.trim() ?? "";
  if (nota.length > 2000) return { ok: false, ...RECHAZOS.nota_larga };
  const r = await accion("atender", "atender_solicitud_equipo", { p_id: id, p_nota: nota || null });
  if (!r.ok && r.status === 404) return { ok: false, status: 404, error: "La solicitud no existe." };
  if (!r.ok && r.status === 409) {
    return { ok: false, status: 409, error: "Otro administrador ya la marcó, o la empresa la retiró. Recarga la bandeja." };
  }
  return r;
}
