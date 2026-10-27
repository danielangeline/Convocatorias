"use client";

import { cn } from "@/lib/utils";

export interface Pestana<T extends string> {
  valor: T;
  etiqueta: string;
  conteo?: number;
}

/** Pestañas subrayadas con conteo en mono. */
export function Tabs<T extends string>({
  pestanas,
  valor,
  onChange,
  etiqueta,
  className,
}: {
  pestanas: Pestana<T>[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={cn("flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line", className)}
    >
      {pestanas.map((p) => {
        const activa = p.valor === valor;
        return (
          <button
            key={p.valor}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(p.valor)}
            className={cn(
              "-mb-px flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap border-b-2 px-3.5 text-[13px] font-bold transition-colors",
              activa ? "border-pri text-pri-text" : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            {p.etiqueta}
            {p.conteo !== undefined && (
              <span className="font-tabular rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                {p.conteo}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
