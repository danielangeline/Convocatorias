import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type {
  CategoriaAdmin,
  ConvocatoriaAdmin,
  ConvocatoriaAdminListado,
  DocumentoAdmin,
  EstadoConvocatoria,
  FuenteAdmin,
  RequisitoAdmin,
  TipoCategoria,
  TipoDocumento,
  TipoRequisito,
} from "@/lib/types";
import type { Resultado } from "./administradores";

/**
 * Catálogo en el panel de administración (CU-01..04, RF-04..08, docs/05 §9.13).
 * Quien llama ya comprobó la sesión de administrador con aal2
 * (`conAdministrador` o el layout del panel). Todo se lee y escribe con esa
 * sesión, así que la RLS es otra barrera. Aquí se valida la forma de los datos
 * antes de tocar la base (RNF-29: el enlace se valida en el servidor); las
 * reglas entre filas las repite `guardar_convocatoria`.
 */

type Cuerpo = Record<string, unknown> | null;
type Rechazo = { ok: false; status: number; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_CATEGORIA: TipoCategoria[] = ["tipo_proyecto", "sector", "tipo_entidad"];
const TIPOS_REQUISITO: TipoRequisito[] = ["documento", "condicion"];

const invalido = (error: string): Rechazo => ({ ok: false, status: 400, error });

// El SQL rechaza con una clave estable en `hint` (docs/05 §9.13).
const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_admin: { status: 404, error: "No encontrado." },
  no_existe: { status: 404, error: "La convocatoria no existe." },
  fuente_invalida: { status: 400, error: "La fuente no existe o está inactiva." },
  categoria_invalida: { status: 400, error: "Hay una categoría inexistente o inactiva." },
  requisito_ajeno: { status: 400, error: "Uno de los requisitos no pertenece a esta convocatoria. Recarga la página." },
  publicada_incompleta: {
    status: 409,
    error: "Una convocatoria publicada necesita el enlace oficial y al menos un requisito. Despublícala antes de quitarlos.",
  },
};

function rechazo(error: PostgrestError, accion: string): Rechazo {
  const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
  if (conocido) return { ok: false, ...conocido };
  if (error.code === "23505") return { ok: false, status: 409, error: "Ya existe un registro con ese nombre." };
  if (error.code === "23514") return invalido("Algún dato no cumple las reglas: revisa montos, fechas y enlaces.");
  console.error(`Catálogo: ${accion} falló`, error.code, error.message);
  return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

// ---------------------------------------------------------------------------
// Validación de forma
// ---------------------------------------------------------------------------

/** Texto recortado; null si no es texto. */
function texto(valor: unknown, maximo: number): string | null {
  return typeof valor === "string" ? valor.trim().slice(0, maximo) : null;
}

/**
 * RNF-29: URL http/https bien formada, con dominio que tenga punto y sin
 * espacios — lo mismo que exige la restricción de la tabla.
 */
export function esUrlHttp(valor: string): boolean {
  if (/\s/.test(valor)) return false;
  try {
    const url = new URL(valor);
    return (url.protocol === "http:" || url.protocol === "https:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Enlace opcional: "" se guarda como vacío; cualquier otra cosa debe ser http/https. */
function enlace(valor: unknown, campo: string): { ok: true; valor: string } | Rechazo {
  const v = texto(valor, 2000) ?? "";
  if (v && !esUrlHttp(v)) return invalido(`${campo}: debe ser un enlace que empiece por http:// o https://.`);
  return { ok: true, valor: v };
}

function fechaValida(valor: string): boolean {
  if (!FECHA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

function monto(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : typeof valor === "string" ? Number(valor) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 1e15 ? n : undefined;
}

// ---------------------------------------------------------------------------
// Fuentes (CU-01, RF-04)
// ---------------------------------------------------------------------------

const aFuente = (f: {
  id: string;
  nombre: string;
  tipo_entidad: string | null;
  url: string | null;
  notas_parametrizacion: string | null;
  activa: boolean;
}): FuenteAdmin => ({
  id: f.id,
  nombre: f.nombre,
  tipoEntidad: f.tipo_entidad ?? "",
  url: f.url ?? "",
  notas: f.notas_parametrizacion ?? "",
  activa: f.activa,
});

const COLUMNAS_FUENTE = "id, nombre, tipo_entidad, url, notas_parametrizacion, activa";

export async function listarFuentes(): Promise<FuenteAdmin[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("fuentes").select(COLUMNAS_FUENTE).order("nombre");
  if (error) throw new Error(`No se pudieron leer las fuentes: ${error.message}`);
  return (data ?? []).map(aFuente);
}

function datosFuente(cuerpo: Cuerpo): { ok: true; fila: Record<string, unknown> } | Rechazo {
  const nombre = texto(cuerpo?.nombre, 200);
  if (!nombre) return invalido("Escribe el nombre de la fuente.");
  const url = enlace(cuerpo?.url, "URL de la fuente");
  if (!url.ok) return url;
  return {
    ok: true,
    fila: {
      nombre,
      tipo_entidad: texto(cuerpo?.tipoEntidad, 100) || null,
      url: url.valor || null,
      notas_parametrizacion: texto(cuerpo?.notas, 4000) || null,
      activa: cuerpo?.activa !== false,
    },
  };
}

export async function crearFuente(cuerpo: Cuerpo): Promise<Resultado<FuenteAdmin>> {
  const datos = datosFuente(cuerpo);
  if (!datos.ok) return datos;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("fuentes").insert(datos.fila).select(COLUMNAS_FUENTE).single();
  if (error) return rechazo(error, "crear fuente");
  return { ok: true, datos: aFuente(data) };
}

/** Editar, activar o desactivar. No hay borrado: conserva las convocatorias históricas (RN-07). */
export async function editarFuente(id: string, cuerpo: Cuerpo): Promise<Resultado<FuenteAdmin>> {
  const datos = datosFuente(cuerpo);
  if (!datos.ok) return datos;
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("fuentes")
    .update(datos.fila)
    .eq("id", id)
    .select(COLUMNAS_FUENTE)
    .maybeSingle();
  if (error) return rechazo(error, "editar fuente");
  if (!data) return { ok: false, status: 404, error: "La fuente no existe." };
  return { ok: true, datos: aFuente(data) };
}

// ---------------------------------------------------------------------------
// Categorías (RF-06)
// ---------------------------------------------------------------------------

export async function listarCategorias(): Promise<CategoriaAdmin[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("categorias").select("id, tipo, nombre, activa").order("nombre");
  if (error) throw new Error(`No se pudieron leer las categorías: ${error.message}`);
  return (data ?? []).map((c) => ({ id: c.id, tipo: c.tipo as TipoCategoria, nombre: c.nombre, activa: c.activa }));
}

export async function crearCategoria(cuerpo: Cuerpo): Promise<Resultado<CategoriaAdmin>> {
  const tipo = cuerpo?.tipo as TipoCategoria;
  const nombre = texto(cuerpo?.nombre, 100);
  if (!TIPOS_CATEGORIA.includes(tipo)) return invalido("Tipo de categoría no válido.");
  if (!nombre) return invalido("Escribe el nombre de la categoría.");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categorias")
    .insert({ tipo, nombre })
    .select("id, tipo, nombre, activa")
    .single();
  if (error) return rechazo(error, "crear categoría");
  return { ok: true, datos: { ...data, tipo: data.tipo as TipoCategoria } };
}

/** Renombrar o activar/desactivar. Una categoría no se borra: puede estar asignada. */
export async function editarCategoria(id: string, cuerpo: Cuerpo): Promise<Resultado<CategoriaAdmin>> {
  const cambios: Record<string, unknown> = {};
  if (cuerpo?.nombre !== undefined) {
    const nombre = texto(cuerpo.nombre, 100);
    if (!nombre) return invalido("Escribe el nombre de la categoría.");
    cambios.nombre = nombre;
  }
  if (cuerpo?.activa !== undefined) {
    if (typeof cuerpo.activa !== "boolean") return invalido("Estado de la categoría no válido.");
    cambios.activa = cuerpo.activa;
  }
  if (Object.keys(cambios).length === 0) return invalido("No hay cambios que guardar.");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("categorias")
    .update(cambios)
    .eq("id", id)
    .select("id, tipo, nombre, activa")
    .maybeSingle();
  if (error) return rechazo(error, "editar categoría");
  if (!data) return { ok: false, status: 404, error: "La categoría no existe." };
  return { ok: true, datos: { ...data, tipo: data.tipo as TipoCategoria } };
}

// ---------------------------------------------------------------------------
// Convocatorias (CU-02, CU-04, RF-05, RF-06, RF-08)
// ---------------------------------------------------------------------------

export async function listarConvocatorias(): Promise<ConvocatoriaAdminListado[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("convocatorias")
    .select("id, nombre, entidad_convocante, monto_min, monto_max, fecha_cierre, estado, fuentes (nombre)")
    .order("actualizado_at", { ascending: false })
    .limit(1000);
  if (error) throw new Error(`No se pudieron leer las convocatorias: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    entidadConvocante: c.entidad_convocante,
    fuenteNombre: (c.fuentes as unknown as { nombre: string } | null)?.nombre ?? null,
    montoMin: c.monto_min === null ? null : Number(c.monto_min),
    montoMax: c.monto_max === null ? null : Number(c.monto_max),
    fechaCierre: c.fecha_cierre,
    estado: c.estado as EstadoConvocatoria,
  }));
}

export async function obtenerConvocatoria(id: string): Promise<ConvocatoriaAdmin | null> {
  const supabase = await crearClienteServidor();
  const { data: c, error } = await supabase
    .from("convocatorias")
    .select(
      "id, fuente_id, nombre, entidad_convocante, descripcion, monto_min, monto_max, ubicacion_cobertura, fecha_apertura, fecha_cierre, url_postulacion, estado, publicada_at, actualizado_at, convocatoria_categoria (categoria_id), requisitos_convocatoria (id, descripcion, tipo, obligatorio, orden), documentos_convocatoria (id, tipo_doc, nombre, tipo_mime, tamano_bytes, creado_at)"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer la convocatoria: ${error.message}`);
  if (!c) return null;

  const requisitos = (c.requisitos_convocatoria ?? [])
    .slice()
    .sort((a, b) => a.orden - b.orden)
    .map((r): RequisitoAdmin => ({
      id: r.id,
      descripcion: r.descripcion,
      tipo: r.tipo as TipoRequisito,
      obligatorio: r.obligatorio,
    }));
  const documentos = (c.documentos_convocatoria ?? [])
    .slice()
    .sort((a, b) => a.creado_at.localeCompare(b.creado_at))
    .map((d): DocumentoAdmin => ({
      id: d.id,
      tipo: d.tipo_doc as TipoDocumento,
      nombre: d.nombre,
      tipoMime: d.tipo_mime ?? "",
      tamanoBytes: d.tamano_bytes === null ? null : Number(d.tamano_bytes),
      creadoAt: d.creado_at,
    }));

  return {
    id: c.id,
    fuenteId: c.fuente_id,
    nombre: c.nombre,
    entidadConvocante: c.entidad_convocante,
    descripcion: c.descripcion ?? "",
    montoMin: c.monto_min === null ? null : Number(c.monto_min),
    montoMax: c.monto_max === null ? null : Number(c.monto_max),
    ubicacion: c.ubicacion_cobertura ?? "",
    fechaApertura: c.fecha_apertura,
    fechaCierre: c.fecha_cierre,
    urlPostulacion: c.url_postulacion ?? "",
    estado: c.estado as EstadoConvocatoria,
    publicadaAt: c.publicada_at,
    actualizadoAt: c.actualizado_at,
    categorias: (c.convocatoria_categoria ?? []).map((cc) => cc.categoria_id),
    requisitos,
    documentos,
  };
}

/**
 * CU-02 paso 1 · Crea la convocatoria en borrador, asociada a una fuente activa.
 * Pide lo mínimo que la tabla exige; el resto se completa en el editor (2a).
 */
export async function crearConvocatoria(cuerpo: Cuerpo, usuarioId: string): Promise<Resultado<{ id: string }>> {
  const fuenteId = texto(cuerpo?.fuenteId, 36) ?? "";
  const nombre = texto(cuerpo?.nombre, 300);
  const entidad = texto(cuerpo?.entidadConvocante, 200);
  const cierre = texto(cuerpo?.fechaCierre, 10) ?? "";
  if (!UUID.test(fuenteId)) return invalido("Elige la fuente de la convocatoria.");
  if (!nombre) return invalido("Escribe el nombre de la convocatoria.");
  if (!entidad) return invalido("Escribe la entidad convocante.");
  if (!fechaValida(cierre)) return invalido("Indica una fecha de cierre válida.");

  const supabase = await crearClienteServidor();
  const { data: fuente, error: eFuente } = await supabase
    .from("fuentes")
    .select("id")
    .eq("id", fuenteId)
    .eq("activa", true)
    .maybeSingle();
  if (eFuente) return rechazo(eFuente, "leer fuente");
  if (!fuente) return invalido("La fuente no existe o está inactiva.");

  const { data, error } = await supabase
    .from("convocatorias")
    .insert({
      fuente_id: fuenteId,
      nombre,
      entidad_convocante: entidad,
      fecha_cierre: cierre,
      estado: "borrador",
      creado_por: usuarioId,
    })
    .select("id")
    .single();
  if (error) return rechazo(error, "crear convocatoria");
  return { ok: true, datos: { id: data.id } };
}

/**
 * CU-02 2a, CU-04 · Guarda datos, categorías y requisitos en una transacción
 * (`guardar_convocatoria`). No cambia el estado (RF-09 tiene su endpoint).
 */
export async function guardarConvocatoria(id: string, cuerpo: Cuerpo): Promise<Resultado<ConvocatoriaAdmin>> {
  const nombre = texto(cuerpo?.nombre, 300);
  const entidad = texto(cuerpo?.entidadConvocante, 200);
  if (!nombre) return invalido("Escribe el nombre de la convocatoria.");
  if (!entidad) return invalido("Escribe la entidad convocante.");

  const fuenteId = texto(cuerpo?.fuenteId, 36) ?? "";
  if (fuenteId && !UUID.test(fuenteId)) return invalido("Fuente no válida.");

  const montoMin = monto(cuerpo?.montoMin);
  const montoMax = monto(cuerpo?.montoMax);
  if (montoMin === undefined || montoMax === undefined) return invalido("Los montos deben ser números positivos.");
  if (montoMin !== null && montoMax !== null && montoMin > montoMax) {
    return invalido("El monto mínimo no puede ser mayor que el máximo.");
  }

  const apertura = texto(cuerpo?.fechaApertura, 10) ?? "";
  const cierre = texto(cuerpo?.fechaCierre, 10) ?? "";
  if (apertura && !fechaValida(apertura)) return invalido("La fecha de apertura no es válida.");
  if (!fechaValida(cierre)) return invalido("Indica una fecha de cierre válida.");
  if (apertura && apertura > cierre) return invalido("La fecha de apertura debe ser anterior a la de cierre.");

  // RNF-29: el enlace oficial se valida aquí, antes de guardar.
  const url = enlace(cuerpo?.urlPostulacion, "Enlace oficial de postulación");
  if (!url.ok) return url;

  const categorias = cuerpo?.categorias ?? [];
  if (!Array.isArray(categorias) || categorias.length > 100 || !categorias.every((c) => typeof c === "string" && UUID.test(c))) {
    return invalido("Categorías no válidas.");
  }

  const requisitosCrudos = cuerpo?.requisitos ?? [];
  if (!Array.isArray(requisitosCrudos) || requisitosCrudos.length > 200) return invalido("Requisitos no válidos.");
  const requisitos: RequisitoAdmin[] = [];
  for (const r of requisitosCrudos as Record<string, unknown>[]) {
    const descripcion = texto(r?.descripcion, 1000);
    const tipo = r?.tipo as TipoRequisito;
    const idReq = r?.id === undefined || r?.id === null || r?.id === "" ? undefined : texto(r.id, 36);
    if (!descripcion) return invalido("Cada requisito necesita una descripción.");
    if (!TIPOS_REQUISITO.includes(tipo)) return invalido("Tipo de requisito no válido.");
    if (idReq !== undefined && (!idReq || !UUID.test(idReq))) return invalido("Requisito no válido.");
    requisitos.push({ id: idReq, descripcion, tipo, obligatorio: r?.obligatorio !== false });
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_convocatoria", {
    p_id: id,
    p_datos: {
      fuente_id: fuenteId,
      nombre,
      entidad_convocante: entidad,
      descripcion: texto(cuerpo?.descripcion, 10000) ?? "",
      monto_min: montoMin === null ? "" : String(montoMin),
      monto_max: montoMax === null ? "" : String(montoMax),
      ubicacion_cobertura: texto(cuerpo?.ubicacion, 300) ?? "",
      fecha_apertura: apertura,
      fecha_cierre: cierre,
      url_postulacion: url.valor,
    },
    p_categorias: [...new Set(categorias as string[])],
    p_requisitos: requisitos.map((r) => ({ id: r.id ?? "", descripcion: r.descripcion, tipo: r.tipo, obligatorio: r.obligatorio })),
  });
  if (error) return rechazo(error, "guardar convocatoria");

  const guardada = await obtenerConvocatoria(id);
  if (!guardada) return { ok: false, status: 404, error: "La convocatoria no existe." };
  return { ok: true, datos: guardada };
}
