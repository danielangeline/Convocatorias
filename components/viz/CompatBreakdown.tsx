import { Check, Minus } from "lucide-react";

export interface CriterioCompat {
  nombre: string;
  /** coincide = ✓ en `pri-soft`; no_coincide = ! en `rose-soft`; parcial = guion («sin dato»). */
  estado: "coincide" | "no_coincide" | "parcial";
  resultado: string;
}

/** Desglose del cruce (CU-10): un criterio por fila con icono redondo de 24 px, nombre y resultado. */
export function CompatBreakdown({ criterios }: { criterios: CriterioCompat[] }) {
  if (criterios.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {criterios.map((c) => (
        <li key={c.nombre} className="flex items-center gap-3 text-sm">
          <span
            className={`grid h-6 w-6 flex-none place-items-center rounded-full ${
              c.estado === "coincide"
                ? "bg-pri-soft text-pri-text"
                : c.estado === "no_coincide"
                  ? "bg-rose-soft text-rose"
                  : "bg-surface-2 text-ink-3"
            }`}
          >
            {c.estado === "coincide" ? (
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-label="Coincide" />
            ) : c.estado === "no_coincide" ? (
              <span aria-label="No coincide" className="text-xs font-bold leading-none">
                !
              </span>
            ) : (
              <Minus className="h-3.5 w-3.5" strokeWidth={3} aria-label="Sin dato" />
            )}
          </span>
          <span className="flex-1 font-semibold text-ink">{c.nombre}</span>
          <span className="text-[13px] text-ink-3">{c.resultado}</span>
        </li>
      ))}
    </ul>
  );
}
