"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCALIZABLES = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Hoja inferior para móvil: radio superior de 12 px, hasta el 86 % de la
 * altura. Cierra con Esc y al tocar el overlay, atrapa el foco y lo devuelve a
 * quien la abrió.
 */
export function BottomSheet({
  abierto,
  onCerrar,
  titulo,
  children,
  pie,
  lateralLg = false,
  className,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
  pie?: React.ReactNode;
  /** En escritorio (≥ 1024 px) se vuelve un panel lateral derecho de 420 px (p. ej. los filtros). */
  lateralLg?: boolean;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onCerrar();
      if (e.key !== "Tab" || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCALIZABLES)];
      if (items.length === 0) return;
      const primero = items[0];
      const ultimo = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === primero || document.activeElement === panel.current)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus?.();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-overlay" onClick={onCerrar} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className={cn(
          "absolute inset-x-0 bottom-0 flex max-h-[86%] flex-col rounded-t-xl border-t border-line bg-surface shadow-card outline-none",
          lateralLg && "lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[420px] lg:rounded-none lg:border-l lg:border-t-0",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="font-display text-xl font-semibold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
        {pie && <div className="border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{pie}</div>}
      </div>
    </div>
  );
}
