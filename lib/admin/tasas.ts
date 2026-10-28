import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyColombia } from "@/lib/fechas";

/**
 * RF-117, RN-40 · Tasas de referencia por moneda (docs/05 §9.36): cuántos pesos
 * vale una unidad, desde qué fecha y quién la fijó. Solo sirven para comparar
 * montos en pesos; nunca cambian el monto guardado de una convocatoria.
 */

export interface TasaAdmin {
  moneda: string;
  nombreMoneda: string;
  copPorUnidad: number;
  vigenteDesde: string;
  actualizadoAt: string;
}

type Resultado<T> = { ok: true; datos: T; aviso?: string } | { ok: false; status: number; error: string };

const RECHAZOS: Record<string, { status: number; error: string }> = {
  no_es_admin: { status: 404, error: "No encontrado." },
  moneda_invalida: { status: 400, error: "La moneda no existe o es el peso colombiano." },
  tasa_invalida: { status: 400, error: "La tasa debe ser mayor que cero." },
  fecha_invalida: { status: 400, error: "La fecha de la tasa no puede ser futura." },
};

export async function listarTasasAdmin(): Promise<TasaAdmin[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("tasas_referencia")
    .select("moneda, cop_por_unidad, vigente_desde, actualizado_at, monedas (nombre)")
    .order("moneda");
  if (error) throw new Error(`No se pudieron leer las tasas: ${error.message}`);
  return (data ?? []).map((t) => ({
    moneda: t.moneda,
    nombreMoneda: (t.monedas as unknown as { nombre: string } | null)?.nombre ?? t.moneda,
    copPorUnidad: Number(t.cop_por_unidad),
    vigenteDesde: t.vigente_desde,
    actualizadoAt: t.actualizado_at,
  }));
}

/**
 * Pesos por unidad en formato colombiano: «4.150,25» o «4150,25» (coma decimal,
 * hasta 4 decimales). Un formato ambiguo se rechaza, como los montos (CU-02 2b).
 */
export function leerTasa(valor: unknown): { ok: true; valor: number } | { ok: false; error: string } {
  const t = typeof valor === "number" ? String(valor).replace(".", ",") : String(valor ?? "").trim();
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,4})?$/.test(t)) {
    return { ok: false, error: "Escribe la tasa en pesos, con coma decimal (p. ej. 4.150,25)." };
  }
  const n = Number(t.replace(/\./g, "").replace(",", "."));
  if (!(n > 0) || n >= 1e10) return { ok: false, error: "La tasa debe ser mayor que cero." };
  return { ok: true, valor: n };
}

export async function guardarTasa(cuerpo: Record<string, unknown> | null): Promise<Resultado<TasaAdmin[]>> {
  const moneda = String(cuerpo?.moneda ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda) || moneda === "COP") return { ok: false, ...RECHAZOS.moneda_invalida };
  const tasa = leerTasa(cuerpo?.copPorUnidad);
  if (!tasa.ok) return { ok: false, status: 400, error: tasa.error };
  const fecha = String(cuerpo?.vigenteDesde ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(`${fecha}T00:00:00Z`))) {
    return { ok: false, status: 400, error: "Indica una fecha válida." };
  }
  if (fecha > hoyColombia()) return { ok: false, ...RECHAZOS.fecha_invalida };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_tasa", { p_moneda: moneda, p_cop_por_unidad: tasa.valor, p_vigente_desde: fecha });
  if (error) {
    const conocido = error.hint ? RECHAZOS[error.hint] : undefined;
    if (conocido) return { ok: false, ...conocido };
    console.error("Tasas: no se pudo guardar", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos guardar la tasa. Intenta de nuevo." };
  }
  return { ok: true, datos: await listarTasasAdmin() };
}
