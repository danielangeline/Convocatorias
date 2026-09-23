import "server-only";
import { createClient } from "@supabase/supabase-js";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { firmarDescarga } from "@/lib/supabase/descarga";
import type { Categoria, Convocatoria, Documento, EstadoConvocatoria, TipoCategoria, TipoDocumento, TipoRequisito } from "@/lib/types";

/**
 * Catálogo de convocatorias para la empresa (RF-11, RF-12, RF-13, CU-07, CU-08 ·
 * Sprint 2 paso 4). Todo se lee con la sesión de quien pide: **la RLS decide qué
 * existe** (RN-33, docs/05 §9.10) y aquí no hay otra lista de permisos.
 */

const COLUMNAS =
  "id, nombre, entidad_convocante, descripcion, monto_min, monto_max, ubicacion_cobertura, fecha_apertura, fecha_cierre, url_postulacion, estado, convocatoria_categoria (categoria_id), requisitos_convocatoria (id, descripcion, tipo, obligatorio, orden), documentos_convocatoria (id, tipo_doc, nombre, storage_path, tamano_bytes)";

const BUCKET = "documentos-convocatorias";

type Fila = {
  id: string;
  nombre: string;
  entidad_convocante: string;
  descripcion: string | null;
  monto_min: number | string | null;
  monto_max: number | string | null;
  ubicacion_cobertura: string | null;
  fecha_apertura: string | null;
  fecha_cierre: string;
  url_postulacion: string | null;
  estado: EstadoConvocatoria;
  convocatoria_categoria: { categoria_id: string }[];
  requisitos_convocatoria: { id: string; descripcion: string; tipo: TipoRequisito; obligatorio: boolean; orden: number }[];
  documentos_convocatoria: { id: string; tipo_doc: TipoDocumento; nombre: string; storage_path: string; tamano_bytes: number | null }[];
};

const numero = (v: number | string | null) => (v === null ? null : Number(v));
const extensionDe = (ruta: string) => ruta.slice(ruta.lastIndexOf(".") + 1).toLowerCase();

function aConvocatoria(f: Fila): Convocatoria {
  return {
    id: f.id,
    nombre: f.nombre,
    entidadConvocante: f.entidad_convocante,
    descripcion: f.descripcion ?? "",
    montoMin: numero(f.monto_min),
    montoMax: numero(f.monto_max),
    ubicacion: f.ubicacion_cobertura ?? "",
    fechaApertura: f.fecha_apertura,
    fechaCierre: f.fecha_cierre,
    estado: f.estado,
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
  };
}

// `cache` de React: el layout y la página piden lo mismo en una petición.

/**
 * RF-11 · Publicadas y vigentes, las que cierran antes primero. El filtro es
 * explícito aunque la RLS ya lo aplique: la empresa también ve las convocatorias
 * ligadas a sus postulaciones aunque hayan cerrado, y esas no son catálogo.
 */
export const listarCatalogo = cache(async (): Promise<Convocatoria[]> => {
  const supabase = await crearClienteServidor();
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("convocatorias")
    .select(COLUMNAS)
    .eq("estado", "publicada")
    .gte("fecha_cierre", hoy)
    .order("fecha_cierre", { ascending: true });
  if (error) {
    console.error("Catálogo: no se pudo listar", error.code, error.message);
    return [];
  }
  return (data as unknown as Fila[]).map(aConvocatoria);
});

/** RF-13, CU-08 · La ficha que la sesión puede ver, o null si para ella no existe. */
export const obtenerFicha = cache(async (id: string): Promise<Convocatoria | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("convocatorias").select(COLUMNAS).eq("id", id).maybeSingle();
  if (error) console.error("Catálogo: no se pudo leer la ficha", error.code, error.message);
  return data ? aConvocatoria(data as unknown as Fila) : null;
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
