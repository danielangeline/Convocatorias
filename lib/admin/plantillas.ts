import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { PlantillaAdmin } from "@/lib/types";
import type { Resultado } from "./administradores";

// CU-37 · RF-63 · Versiones de la plantilla de generación (docs/05 §9.27).
// Todo va con la sesión del administrador: la RLS deja leer y las funciones
// de la base exigen aal2 (RNF-28). Una versión no se edita: se crea la siguiente.

type Cuerpo = Record<string, unknown> | null;
const invalido = (error: string) => ({ ok: false as const, status: 400, error });

export const LIMITES_PLANTILLA = {
  contenidoMin: 200,
  contenidoMax: 50_000,
  precioMax: 1_000,
  topeMin: 1_000,
  topeMax: 400_000,
} as const;
const MODELO = /^[a-z0-9._-]{1,60}$/;

function rechazo(error: PostgrestError, accion: string) {
  if (error.hint === "no_es_admin") return { ok: false as const, status: 404, error: "No encontrado." };
  if (error.hint === "plantilla_no_existe") return { ok: false as const, status: 404, error: "La versión no existe." };
  if (error.code === "23514") return invalido("Algún dato no cumple las reglas: revisa el texto, el modelo, los precios y el tope.");
  console.error(`Plantillas: ${accion} falló`, error.code, error.message);
  return { ok: false as const, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

const numero = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function listarPlantillas(): Promise<PlantillaAdmin[]> {
  const supabase = await crearClienteServidor();
  const [{ data: filas, error }, { data: estadisticas, error: eEst }] = await Promise.all([
    supabase
      .from("plantillas_generacion")
      .select("id, version, contenido, activa, modelo, precio_entrada_usd_mtok, precio_salida_usd_mtok, tope_caracteres_tdr, creado_at, activada_at")
      .order("version", { ascending: false }),
    supabase.rpc("estadisticas_plantillas"),
  ]);
  if (error) throw new Error(`Plantillas: listar falló (${error.code})`);
  if (eEst) throw new Error(`Plantillas: estadísticas fallaron (${eEst.code})`);
  const porId = new Map<string, Record<string, unknown>>((estadisticas ?? []).map((e: Record<string, unknown>) => [e.plantilla_id as string, e]));
  return (filas ?? []).map((f) => {
    const e: Record<string, unknown> = porId.get(f.id) ?? {};
    return {
      id: f.id,
      version: f.version,
      contenido: f.contenido,
      activa: f.activa,
      modelo: f.modelo,
      precioEntradaUsdMtok: Number(f.precio_entrada_usd_mtok),
      precioSalidaUsdMtok: Number(f.precio_salida_usd_mtok),
      topeCaracteresTdr: f.tope_caracteres_tdr,
      creadoAt: f.creado_at,
      activadaAt: f.activada_at,
      documentos: Number(e.documentos ?? 0),
      generacionesExitosas: Number(e.generaciones_exitosas ?? 0),
      generacionesFallidas: Number(e.generaciones_fallidas ?? 0),
      tokensEntradaPromedio: numero(e.tokens_entrada_promedio),
      tokensSalidaPromedio: numero(e.tokens_salida_promedio),
      costoPromedioUsd: numero(e.costo_promedio_usd),
      pendientesPromedio: numero(e.pendientes_promedio),
    };
  });
}

/** Cuerpo: { contenido, modelo, precioEntradaUsdMtok, precioSalidaUsdMtok, topeCaracteresTdr }. */
export async function crearVersionPlantilla(cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const contenido = typeof cuerpo?.contenido === "string" ? cuerpo.contenido.trim() : "";
  const modelo = typeof cuerpo?.modelo === "string" ? cuerpo.modelo.trim() : "";
  const entrada = Number(cuerpo?.precioEntradaUsdMtok);
  const salida = Number(cuerpo?.precioSalidaUsdMtok);
  const tope = Number(cuerpo?.topeCaracteresTdr);
  const L = LIMITES_PLANTILLA;
  if (contenido.length < L.contenidoMin || contenido.length > L.contenidoMax) {
    return invalido(`La instrucción debe tener entre ${L.contenidoMin.toLocaleString("es-CO")} y ${L.contenidoMax.toLocaleString("es-CO")} caracteres.`);
  }
  if (!MODELO.test(modelo)) return invalido("Escribe el identificador del modelo tal como lo publica OpenAI (p. ej. gpt-5.4-mini).");
  const precioValido = (p: number) => Number.isFinite(p) && p >= 0 && p <= L.precioMax;
  if (!precioValido(entrada) || !precioValido(salida)) return invalido(`Los precios van en USD por millón de tokens, entre 0 y ${L.precioMax}.`);
  if (!Number.isInteger(tope) || tope < L.topeMin || tope > L.topeMax) {
    return invalido(`El tope del TDR debe ser un entero entre ${L.topeMin.toLocaleString("es-CO")} y ${L.topeMax.toLocaleString("es-CO")} caracteres.`);
  }
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_version_plantilla", {
    p_contenido: contenido,
    p_modelo: modelo,
    p_precio_entrada: entrada,
    p_precio_salida: salida,
    p_tope: tope,
  });
  if (error) return rechazo(error, "crear versión");
  return { ok: true, datos: { id: data as string }, aviso: "Versión guardada. Quedó inactiva: actívala cuando quieras usarla." };
}

export async function activarPlantilla(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("activar_plantilla", { p_id: id });
  if (error) return rechazo(error, "activar");
  return { ok: true, aviso: "Versión activada: las próximas generaciones la usan." };
}

// ---------------------------------------------------------------------------
// RF-99 · Plantilla de creación de proyectos (docs/05 §9.30). Mismo régimen;
// no tiene tope de TDR, y sus cifras son las propuestas entregadas y fallidas.
// ---------------------------------------------------------------------------

export async function listarPlantillasProyecto(): Promise<PlantillaAdmin[]> {
  const supabase = await crearClienteServidor();
  const [{ data: filas, error }, { data: estadisticas, error: eEst }] = await Promise.all([
    supabase
      .from("plantillas_proyecto")
      .select("id, version, contenido, activa, modelo, precio_entrada_usd_mtok, precio_salida_usd_mtok, creado_at, activada_at")
      .order("version", { ascending: false }),
    supabase.rpc("estadisticas_plantillas_proyecto"),
  ]);
  if (error) throw new Error(`Plantillas de proyecto: listar falló (${error.code})`);
  if (eEst) throw new Error(`Plantillas de proyecto: estadísticas fallaron (${eEst.code})`);
  const porId = new Map<string, Record<string, unknown>>((estadisticas ?? []).map((e: Record<string, unknown>) => [e.plantilla_id as string, e]));
  return (filas ?? []).map((f) => {
    const e: Record<string, unknown> = porId.get(f.id) ?? {};
    return {
      id: f.id,
      version: f.version,
      contenido: f.contenido,
      activa: f.activa,
      modelo: f.modelo,
      precioEntradaUsdMtok: Number(f.precio_entrada_usd_mtok),
      precioSalidaUsdMtok: Number(f.precio_salida_usd_mtok),
      topeCaracteresTdr: 0,
      creadoAt: f.creado_at,
      activadaAt: f.activada_at,
      documentos: Number(e.exitosas ?? 0),
      generacionesExitosas: Number(e.exitosas ?? 0),
      generacionesFallidas: Number(e.fallidas ?? 0),
      tokensEntradaPromedio: numero(e.tokens_entrada_promedio),
      tokensSalidaPromedio: numero(e.tokens_salida_promedio),
      costoPromedioUsd: numero(e.costo_promedio_usd),
      pendientesPromedio: null,
    };
  });
}

/** Cuerpo: { contenido, modelo, precioEntradaUsdMtok, precioSalidaUsdMtok }. */
export async function crearVersionPlantillaProyecto(cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const contenido = typeof cuerpo?.contenido === "string" ? cuerpo.contenido.trim() : "";
  const modelo = typeof cuerpo?.modelo === "string" ? cuerpo.modelo.trim() : "";
  const entrada = Number(cuerpo?.precioEntradaUsdMtok);
  const salida = Number(cuerpo?.precioSalidaUsdMtok);
  const L = LIMITES_PLANTILLA;
  if (contenido.length < L.contenidoMin || contenido.length > L.contenidoMax) {
    return invalido(`La instrucción debe tener entre ${L.contenidoMin.toLocaleString("es-CO")} y ${L.contenidoMax.toLocaleString("es-CO")} caracteres.`);
  }
  if (!MODELO.test(modelo)) return invalido("Escribe el identificador del modelo tal como lo publica OpenAI (p. ej. gpt-5.4-mini).");
  const precioValido = (p: number) => Number.isFinite(p) && p >= 0 && p <= L.precioMax;
  if (!precioValido(entrada) || !precioValido(salida)) return invalido(`Los precios van en USD por millón de tokens, entre 0 y ${L.precioMax}.`);
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("crear_version_plantilla_proyecto", {
    p_contenido: contenido,
    p_modelo: modelo,
    p_precio_entrada: entrada,
    p_precio_salida: salida,
  });
  if (error) return rechazo(error, "crear versión de proyecto");
  return { ok: true, datos: { id: data as string }, aviso: "Versión guardada. Quedó inactiva: actívala cuando quieras usarla." };
}

export async function activarPlantillaProyecto(id: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("activar_plantilla_proyecto", { p_id: id });
  if (error) return rechazo(error, "activar versión de proyecto");
  return { ok: true, aviso: "Versión activada: los próximos proyectos creados con IA la usan." };
}
