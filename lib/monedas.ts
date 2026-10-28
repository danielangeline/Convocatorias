import { formatCOP, formatRangoCOP } from "@/lib/utils";
import type { Convocatoria } from "@/lib/types";

/**
 * Países y moneda de una convocatoria (RN-39, RN-40 · docs/05 §9.36). Código
 * puro: lo usan el servidor, la pantalla y las pruebas.
 */

/** RN-39: el país de la empresa, mientras el registro sea solo para Colombia (como `privado.pais_de`). */
export const PAIS_EMPRESA = "CO";

type ConMonto = Pick<Convocatoria, "montoMin" | "montoMax" | "moneda" | "montoMinCop" | "montoMaxCop" | "tasaVigenteDesde">;

const esCOP = (c: Pick<Convocatoria, "moneda">) => !c.moneda || c.moneda === "COP";

/** RN-40: el monto mínimo en pesos, para comparar; null si no hay tasa para su moneda. */
export const montoMinCop = (c: ConMonto): number | null =>
  c.montoMinCop !== undefined ? c.montoMinCop : esCOP(c) ? c.montoMin : null;

export const montoMaxCop = (c: ConMonto): number | null =>
  c.montoMaxCop !== undefined ? c.montoMaxCop : esCOP(c) ? c.montoMax : null;

/** Un monto en su moneda, sin decimales: «US$ 100.000», «€ 50.000», «$ 1.000.000». */
export function formatMonto(valor: number, moneda: string = "COP"): string {
  if (moneda === "COP") return formatCOP(valor);
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: moneda, currencyDisplay: "code", maximumFractionDigits: 0 }).format(valor);
  } catch {
    return `${moneda} ${valor.toLocaleString("es-CO")}`;
  }
}

/** El rango tal como lo da la fuente, en su moneda, sin inventar extremos (RNF-23). */
export function formatRangoConvocatoria(c: ConMonto): string {
  if (esCOP(c)) return formatRangoCOP(c.montoMin, c.montoMax);
  const m = c.moneda!;
  const { montoMin: min, montoMax: max } = c;
  if (min != null && max != null) return min === max ? formatMonto(max, m) : `${formatMonto(min, m)} – ${formatMonto(max, m)}`;
  if (max != null) return `Hasta ${formatMonto(max, m)}`;
  if (min != null) return `Desde ${formatMonto(min, m)}`;
  return "Monto no informado";
}

/**
 * RN-40: el equivalente aproximado en pesos con la fecha de la tasa, o null si
 * el monto ya está en pesos, no se informó o no hay tasa para esa moneda.
 */
export function equivalenteCop(c: ConMonto): string | null {
  if (esCOP(c) || (c.montoMin == null && c.montoMax == null)) return null;
  const min = montoMinCop(c);
  const max = montoMaxCop(c);
  if (min == null && max == null) return null;
  const rango = formatRangoCOP(min == null ? null : Math.round(min), max == null ? null : Math.round(max));
  return `≈ ${rango} COP aprox.${c.tasaVigenteDesde ? ` (tasa del ${c.tasaVigenteDesde})` : ""}`;
}

/** RN-39: «Todos los países» o los nombres de la lista. */
export function textoPaises(c: Pick<Convocatoria, "todosLosPaises" | "paises">, nombres: ReadonlyMap<string, string>): string {
  if (c.todosLosPaises) return "Todos los países";
  const lista = (c.paises ?? []).map((p) => nombres.get(p) ?? p).sort((a, b) => a.localeCompare(b, "es"));
  return lista.length ? lista.join(", ") : "Sin países declarados";
}
