import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
export { TIPO_CONSUMO_LABEL } from "./consumo-etiquetas";

/**
 * RF-108 · Registro de consumos de IA para el panel (RF-52). La política
 * «consumos_ia: el administrador lee todos» decide; sin aal2 no hay filas.
 */
export interface ConsumoIA {
  id: string;
  fecha: string;
  tipo: string;
  exito: boolean;
  tokensEntrada: number | null;
  tokensSalida: number | null;
  costoUsd: number | null;
  mensajeError: string | null;
  usuario: string | null;
}


const LIMITE = 200;

export async function listarConsumos(): Promise<ConsumoIA[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("consumos_ia")
    .select("id, fecha, tipo, exito, tokens_entrada, tokens_salida, costo_estimado, mensaje_error, usuario_id")
    .order("fecha", { ascending: false })
    .limit(LIMITE);
  if (error) throw new Error(`Consumo de IA: no se pudo leer (${error.code})`);

  const ids = [...new Set((data ?? []).map((c) => c.usuario_id as string | null).filter((x): x is string => !!x))];
  const nombres = new Map<string, string>();
  if (ids.length > 0) {
    const { data: perfiles } = await supabase.from("perfiles").select("id, nombre, nombre_empresa").in("id", ids);
    for (const p of perfiles ?? []) nombres.set(p.id as string, ((p.nombre_empresa as string | null) ?? (p.nombre as string)) || "");
  }

  return (data ?? []).map((c) => ({
    id: c.id as string,
    fecha: c.fecha as string,
    tipo: c.tipo as string,
    exito: c.exito as boolean,
    tokensEntrada: (c.tokens_entrada as number | null) ?? null,
    tokensSalida: (c.tokens_salida as number | null) ?? null,
    costoUsd: c.costo_estimado === null ? null : Number(c.costo_estimado),
    mensajeError: (c.mensaje_error as string | null) ?? null,
    usuario: c.usuario_id ? (nombres.get(c.usuario_id as string) ?? null) : null,
  }));
}
