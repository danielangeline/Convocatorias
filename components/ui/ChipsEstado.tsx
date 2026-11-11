"use client";

import { cn } from "@/lib/utils";

export interface ChipEstado<T extends string> {
  valor: T;
  etiqueta: string;
  conteo: number;
}

/** Chips de filtro de estado con contador en mono, para los listados del panel. */
export function ChipsEstado<T extends string>({
  chips,
  valor,
  onChange,
  etiqueta,
  className,
}: {
  chips: ChipEstado<T>[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={etiqueta} className={cn("barra-desplazable -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0", className)}>
      {chips.map((c) => {
        const activo = c.valor === valor;
        return (
          <button
            key={c.valor}
            type="button"
            aria-pressed={activo}
            onClick={() => onChange(c.valor)}
            className={cn(
              "inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition-colors",
              activo ? "border-pri bg-pri text-on-pri" : "border-line-strong bg-surface text-ink-2 hover:bg-surface-2"
            )}
          >
            {c.etiqueta}
            <span className={cn("font-tabular text-xs", activo ? "text-on-pri" : "text-ink-3")}>{c.conteo}</span>
          </button>
        );
      })}
    </div>
  );
}
