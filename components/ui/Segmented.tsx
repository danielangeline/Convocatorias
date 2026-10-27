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
        "inline-flex gap-0.5 rounded-xl border border-line bg-surface p-[3px]",
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
              "inline-flex cursor-pointer items-center justify-center gap-2 rounded-[9px] font-bold transition-colors",
              grande ? "h-10 px-4 text-[13px]" : "h-9 min-w-9 px-3 text-[13px]",
              activo ? "bg-pri-soft text-pri-text" : "text-ink-2 hover:text-ink"
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
