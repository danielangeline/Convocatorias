export type Tono = "pri" | "amber" | "violet" | "sky" | "rose" | "neutro";

/** Fondo y texto tonales (16 % del color sobre transparente), válidos en claro y oscuro. */
export const TONO_CLASE: Record<Tono, string> = {
  pri: "bg-pri-soft text-pri-text",
  amber:
    "bg-[color-mix(in_oklch,var(--amber)_16%,transparent)] text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))]",
  violet:
    "bg-[color-mix(in_oklch,var(--violet)_16%,transparent)] text-[color-mix(in_oklch,var(--violet)_65%,var(--ink))]",
  sky: "bg-[color-mix(in_oklch,var(--sky)_16%,transparent)] text-[color-mix(in_oklch,var(--sky)_65%,var(--ink))]",
  rose: "bg-[color-mix(in_oklch,var(--rose)_16%,transparent)] text-[color-mix(in_oklch,var(--rose)_65%,var(--ink))]",
  neutro: "bg-surface-2 text-ink-2",
};

/** Color sólido del token, para barras, puntos y anillos. */
export const TONO_VAR: Record<Tono, string> = {
  pri: "var(--pri)",
  amber: "var(--amber)",
  violet: "var(--violet)",
  sky: "var(--sky)",
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
