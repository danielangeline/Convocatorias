import "server-only";
import { createClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { firmarDescarga } from "@/lib/supabase/descarga";
import { hoyColombia } from "@/lib/fechas";
import { PAIS_EMPRESA } from "@/lib/monedas";
import type { Categoria, Convocatoria, Documento, EstadoConvocatoria, OrigenConvocatoria, TipoConvocatoria, TipoCategoria, TipoDocumento, TipoRequisito } from "@/lib/types";

/**
 * Catálogo de convocatorias para la empresa (RF-11, RF-12, RF-13, CU-07, CU-08 ·
 * Sprint 2 paso 4). Todo se lee con la sesión de quien pide: **la RLS decide qué
 * existe** (RN-33, docs/05 §9.10) y aquí no hay otra lista de permisos.
 */

export const COLUMNAS_CONVOCATORIA =
  "id, nombre, entidad_convocante, descripcion, monto_min, monto_max, ubicacion_cobertura, cobertura_nacional, fecha_apertura, fecha_cierre, url_postulacion, estado, tipo_convocatoria, origen, publicada_at, moneda, todos_los_paises, convocatoria_categoria (categoria_id), convocatoria_departamento (departamento_codigo), convocatoria_pais (pais_codigo), requisitos_convocatoria (id, descripcion, tipo, obligatorio, orden), documentos_convocatoria (id, tipo_doc, nombre, storage_path, tamano_bytes)";

const BUCKET = "documentos-convocatorias";

export type FilaConvocatoria = {
  id: string;
  nombre: string;
  entidad_convocante: string;
  descripcion: string | null;
  monto_min: number | string | null;
  monto_max: number | string | null;
  ubicacion_cobertura: string | null;
  cobertura_nacional: boolean;
  fecha_apertura: string | null;
  fecha_cierre: string;
  url_postulacion: string | null;
  estado: EstadoConvocatoria;
  tipo_convocatoria: TipoConvocatoria;
  origen: OrigenConvocatoria;
  publicada_at: string | null;
  moneda: string;
  todos_los_paises: boolean;
  convocatoria_pais: { pais_codigo: string }[];
  convocatoria_categoria: { categoria_id: string }[];
  convocatoria_departamento: { departamento_codigo: string }[];
  requisitos_convocatoria: { id: string; descripcion: string; tipo: TipoRequisito; obligatorio: boolean; orden: number }[];
  documentos_convocatoria: { id: string; tipo_doc: TipoDocumento; nombre: string; storage_path: string; tamano_bytes: number | null }[];
};

const numero = (v: number | string | null) => (v === null ? null : Number(v));
const hoy = hoyColombia;
const extensionDe = (ruta: string) => ruta.slice(ruta.lastIndexOf(".") + 1).toLowerCase();

/** RN-40 · Tasa de referencia por moneda: pesos por unidad y desde cuándo. */
export type Tasas = ReadonlyMap<string, { copPorUnidad: number; vigenteDesde: string }>;

export function aConvocatoria(f: FilaConvocatoria, tasas: Tasas = new Map()): Convocatoria {
  const montoMin = numero(f.monto_min);
  const montoMax = numero(f.monto_max);
  const tasa = f.moneda === "COP" ? null : tasas.get(f.moneda) ?? null;
  const enPesos = (v: number | null) => (v == null ? null : f.moneda === "COP" ? v : tasa ? v * tasa.copPorUnidad : null);
  const paises = (f.convocatoria_pais ?? []).map((p) => p.pais_codigo);
  return {
    id: f.id,
    nombre: f.nombre,
    entidadConvocante: f.entidad_convocante,
    descripcion: f.descripcion ?? "",
    montoMin,
    montoMax,
    coberturaNacional: f.cobertura_nacional,
    departamentos: f.convocatoria_departamento.map((d) => d.departamento_codigo),
    ubicacion: f.ubicacion_cobertura ?? "",
    fechaApertura: f.fecha_apertura,
    fechaCierre: f.fecha_cierre,
    // RN-02: para la empresa, una publicada cuya fecha ya pasó está cerrada
    // aunque el job de RF-10 todavía no le haya cambiado el estado.
    estado: f.estado === "publicada" && f.fecha_cierre < hoy() ? "cerrada" : f.estado,
    categorias: f.convocatoria_categoria.map((c) => c.categoria_id),
    requisitos: [...f.requisitos_convocatoria].sort((a, b) => a.orden - b.orden),
    documentos: f.documentos_convocatoria.map(
      (d): Documento => ({
        id: d.id,
        tipo: d.tipo_doc,
        nombre: d.nombre,
        archivo: `${d.nombre}.${extensionDe(d.storage_path)}`,
        pesoKb: Math.max(1, Math.round((d.tamano_bytes ?? 0) / 1024)),
      })
    ),
    urlPostulacion: f.url_postulacion ?? undefined,
    tipo: f.tipo_convocatoria,
    origen: f.origen,
    publicadaAt: f.publicada_at,
    moneda: f.moneda,
    todosLosPaises: f.todos_los_paises,
    paises,
    elegible: f.todos_los_paises || paises.includes(PAIS_EMPRESA),
    montoMinCop: enPesos(montoMin),
    montoMaxCop: enPesos(montoMax),
    tasaVigenteDesde: tasa?.vigenteDesde ?? null,
  };
}

/** RN-40 · Las tasas de referencia que fijó el administrador (RF-117). */
export const listarTasas = cache(async (): Promise<Tasas> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("tasas_referencia").select("moneda, cop_por_unidad, vigente_desde");
  if (error) console.error("Catálogo: no se pudieron leer las tasas", error.code, error.message);
  return new Map((data ?? []).map((t) => [t.moneda as string, { copPorUnidad: Number(t.cop_por_unidad), vigenteDesde: t.vigente_desde as string }]));
});

/** RN-40 · Monedas ISO 4217, para el editor del panel. */
export const listarMonedas = cache(async (): Promise<{ codigo: string; nombre: string }[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("monedas").select("codigo, nombre").order("codigo");
  if (error) console.error("Catálogo: no se pudieron leer las monedas", error.code, error.message);
  return (data ?? []) as { codigo: string; nombre: string }[];
});

/** RN-39 · Nombres de los países (ISO 3166-1), para mostrar la lista de elegibles. */
export const listarPaises = cache(async (): Promise<{ codigo: string; nombre: string }[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("paises").select("codigo, nombre").order("nombre");
  if (error) console.error("Catálogo: no se pudieron leer los países", error.code, error.message);
  return (data ?? []) as { codigo: string; nombre: string }[];
});

// `cache` de React: el layout y la página piden lo mismo en una petición.

/**
 * RF-11, RN-02 · Por defecto, publicadas y vigentes, las que cierran antes
 * primero. Con `incluirCerradas`, además las cerradas (estado `cerrada` o
 * publicadas vencidas), detrás y de la más reciente a la más antigua. El filtro
 * va en la consulta, no solo en la RLS: la RLS deja ver las cerradas para este
 * filtro explícito y las despublicadas ligadas a las postulaciones de la
 * empresa, y ninguna de las dos es el catálogo por defecto.
 *
 * RN-39 · Sin `incluirOtrosPaises`, solo las convocatorias a las que el país de la
 * empresa puede postularse. La pantalla del catálogo pide todas y filtra ella
 * (criterio 21 de RF-12); inicio, menú y sugerencias, solo las elegibles.
 */
export const listarCatalogo = cache(async (incluirCerradas: boolean = false, incluirOtrosPaises: boolean = false): Promise<Convocatoria[]> => {
  const supabase = await crearClienteServidor();
  const consulta = supabase.from("convocatorias").select(COLUMNAS_CONVOCATORIA);
  const { data, error } = incluirCerradas
    ? await consulta.in("estado", ["publicada", "cerrada"])
    : await consulta.eq("estado", "publicada").gte("fecha_cierre", hoy());
  if (error) {
    console.error("Catálogo: no se pudo listar", error.code, error.message);
    return [];
  }
  const tasas = await listarTasas();
  const todas = (data as unknown as FilaConvocatoria[]).map((f) => aConvocatoria(f, tasas)).filter((c) => incluirOtrosPaises || c.elegible);
  const vigentes = todas.filter((c) => c.estado === "publicada").sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));
  const cerradas = todas.filter((c) => c.estado === "cerrada").sort((a, b) => b.fechaCierre.localeCompare(a.fechaCierre));
  return [...vigentes, ...cerradas];
});

/** RF-13, CU-08 · La ficha que la sesión puede ver, o null si para ella no existe. */
export const obtenerFicha = cache(async (id: string): Promise<Convocatoria | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("convocatorias").select(COLUMNAS_CONVOCATORIA).eq("id", id).maybeSingle();
  if (error) console.error("Catálogo: no se pudo leer la ficha", error.code, error.message);
  return data ? aConvocatoria(data as unknown as FilaConvocatoria, await listarTasas()) : null;
});

/** Categorías activas, para los filtros y los chips (RF-12, RF-43). */
export const listarCategoriasActivas = cache(async (): Promise<Categoria[]> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("categorias").select("id, tipo, nombre").eq("activa", true).order("nombre");
  if (error) console.error("Catálogo: no se pudieron leer las categorías", error.code, error.message);
  return (data ?? []) as { id: string; tipo: TipoCategoria; nombre: string }[];
});

/**
 * RNF-16, CU-08 paso 3 · URL firmada de 15 minutos, con el nombre descriptivo.
 * La fila se lee con la sesión de quien pide: si no la ve, no existe para ella.
 * Firmar exige además poder leer el objeto, y la política de Storage lo concede
 * exactamente cuando la fila es visible (docs/05 §9.14).
 */
export async function enlaceDeDescarga(
  convocatoriaId: string,
  documentoId: string
): Promise<{ ok: true; url: string } | { ok: false; status: number; error: string }> {
  const supabase = await crearClienteServidor();
  const { data: fila } = await supabase
    .from("documentos_convocatoria")
    .select("nombre, storage_path")
    .eq("id", documentoId)
    .eq("convocatoria_id", convocatoriaId)
    .maybeSingle();
  if (!fila) return { ok: false, status: 404, error: "El documento no existe." };

  const firma = await firmarDescarga(supabase, BUCKET, fila.storage_path, `${fila.nombre}.${extensionDe(fila.storage_path)}`);
  if ("error" in firma) {
    console.error("Catálogo: no se pudo firmar la descarga", firma.error);
    return { ok: false, status: 500, error: "No pudimos preparar la descarga. Intenta de nuevo." };
  }
  return { ok: true, url: firma.url };
}

export type Indicadores = {
  convocatoriasVigentes: number;
  montoDisponible: number;
  entidades: number;
  consultoresAprobados: number;
};

/**
 * RF-44 · Las cuatro cifras de la landing, con caché de 1 hora. Es la única
 * lectura del catálogo abierta a visitantes (docs/05 §9.8): `indicadores_catalogo()`
 * devuelve agregados y ninguna convocatoria. Se lee con la clave pública y sin
 * cookies, porque lo cacheado no puede depender de la sesión.
 *
 * `unstable_cache` está reemplazado por `use cache` en Next 16, pero `use cache`
 * exige activar `cacheComponents` en todo el proyecto (hallazgo de la sesión 016).
 */
const ETIQUETA_INDICADORES = "indicadores-catalogo";

const indicadoresCacheados = unstable_cache(
  async (): Promise<Indicadores> => {
    const publico = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await publico.rpc("indicadores_catalogo").single<{
      convocatorias_vigentes: number;
      monto_disponible: number | string;
      entidades: number;
      consultores_aprobados: number;
    }>();
    // Se lanza para que el fallo no quede guardado en la caché una hora.
    if (error || !data) throw new Error(`indicadores_catalogo: ${error?.code ?? ""} ${error?.message ?? "sin datos"}`);
    return {
      convocatoriasVigentes: Number(data.convocatorias_vigentes),
      montoDisponible: Number(data.monto_disponible),
      entidades: Number(data.entidades),
      consultoresAprobados: Number(data.consultores_aprobados),
    };
  },
  ["indicadores-catalogo"],
  { revalidate: 3600, tags: [ETIQUETA_INDICADORES] }
);

/**
 * Al publicar, despublicar o editar una convocatoria las cifras cambian: se
 * invalidan ya, en lugar de esperar hasta una hora. Solo desde endpoints.
 */
export function refrescarIndicadores() {
  revalidateTag(ETIQUETA_INDICADORES, { expire: 0 });
}

export async function obtenerIndicadores(): Promise<Indicadores | null> {
  try {
    return await indicadoresCacheados();
  } catch (e) {
    console.error("Indicadores: no se pudieron calcular", e);
    return null;
  }
}
