export type Tono = "pri" | "amber" | "rose" | "neutro";

/** Fondo y texto tonales del rediseño, válidos en claro y oscuro. */
export const TONO_CLASE: Record<Tono, string> = {
  pri: "bg-pri-soft text-pri-text",
  amber: "bg-amber-soft text-ink",
  rose: "bg-rose-soft text-rose",
  neutro: "bg-surface-2 text-ink-2",
};

/** Color sólido del token, para barras, puntos y anillos. */
export const TONO_VAR: Record<Tono, string> = {
  pri: "var(--pri)",
  amber: "var(--amber)",
  rose: "var(--rose)",
  neutro: "var(--ink-3)",
};

/** Montos abreviados para gráficas: M (millones) o miles de M. */
export function montoCorto(valor: number): string {
  if (valor >= 1e12) return `${(valor / 1e12).toFixed(1).replace(".0", "")} B`;
  if (valor >= 1e9) return `${(valor / 1e9).toFixed(1).replace(".0", "")} mM`;
  if (valor >= 1e6) return `${Math.round(valor / 1e6)} M`;
  return `${Math.round(valor / 1e3)} mil`;
}
