import { Check, Minus } from "lucide-react";

export interface CriterioCompat {
  nombre: string;
  /** coincide = check; parcial = guion ("revisar"). */
  estado: "coincide" | "parcial";
  resultado: string;
}

export function CompatBreakdown({ criterios }: { criterios: CriterioCompat[] }) {
  if (criterios.length === 0) return null;
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {criterios.map((c) => (
        <li key={c.nombre} className="flex items-center gap-2.5 text-[13px]">
          <span
            className={`grid h-5 w-5 flex-none place-items-center rounded-md ${
              c.estado === "coincide"
                ? "bg-pri-soft text-pri-text"
                : "bg-[color-mix(in_oklch,var(--amber)_16%,transparent)] text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))]"
            }`}
          >
            {c.estado === "coincide" ? (
              <Check className="h-3 w-3" strokeWidth={3} aria-label="Coincide" />
            ) : (
              <Minus className="h-3 w-3" strokeWidth={3} aria-label="Revisar" />
            )}
          </span>
          <span className="flex-1 font-semibold">{c.nombre}</span>
          <span className="text-xs text-ink-3">{c.resultado}</span>
        </li>
      ))}
    </ul>
  );
}
