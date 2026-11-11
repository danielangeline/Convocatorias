"use client";

import { cn } from "@/lib/utils";

export interface OpcionSegmentada<T extends string> {
  valor: T;
  etiqueta: React.ReactNode;
  titulo?: string;
}

/** Control segmentado: tabs de tipo, vista tarjetas/lista, etc. */
export function Segmented<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  grande = false,
  className,
}: {
  opciones: OpcionSegmentada<T>[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  grande?: boolean;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={cn(
        "inline-flex gap-0.5 rounded-[4px] bg-surface-2 p-[3px]",
        className
      )}
    >
      {opciones.map((o) => {
        const activo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            title={o.titulo}
            aria-pressed={activo}
            onClick={() => onChange(o.valor)}
            className={cn(
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[3px] font-semibold transition-colors",
              grande ? "min-h-11 px-4 text-[13px]" : "min-h-11 min-w-11 px-3 text-[13px]",
              activo ? "bg-surface text-pri-text shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink"
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
