"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel lateral con overlay. `lado="derecha"` (480 px) para fichas;
 * `lado="izquierda"` para filtros o el menú móvil. Cierra con Esc y al
 * hacer clic fuera; devuelve el foco a quien lo abrió.
 */
export function Drawer({
  abierto,
  onCerrar,
  titulo,
  lado = "derecha",
  ancho = 480,
  pie,
  children,
  className,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  lado?: "derecha" | "izquierda";
  ancho?: number;
  pie?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const previo = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      previo?.focus?.();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onCerrar} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        style={{ width: `min(100%, ${ancho}px)` }}
        className={cn(
          "absolute top-0 flex h-full flex-col border-line bg-surface shadow-card outline-none",
          lado === "derecha" ? "right-0 border-l" : "left-0 border-r",
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="text-[15px] font-extrabold text-ink">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] text-ink-3 hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {pie && <div className="border-t border-line bg-surface p-4">{pie}</div>}
      </div>
    </div>
  );
}
