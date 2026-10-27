"use client";

import { LogOut } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { cerrarSesion } from "@/lib/acciones/auth";
import { cn } from "@/lib/utils";

function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

/** Identidad de la sesión y cierre de sesión (CU-14). */
export function MenuUsuario({ tono = "amber" }: { tono?: "amber" | "sky" | "pri" }) {
  const sesion = useAppStore((s) => s.sesion);
  if (!sesion) return null;
  const titulo = sesion.nombreEmpresa ?? sesion.nombre;

  return (
    <div className="flex items-center gap-2">
      <div
        title={`${titulo} · ${sesion.correo}`}
        className={cn(
          "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ring-1 sm:flex",
          tono === "amber" && "bg-amber/10 text-amber-ink ring-amber/30",
          tono === "sky" && "bg-sky/10 text-sky-ink ring-sky/30",
          tono === "pri" && "bg-pri-soft text-pri-text ring-pri-soft"
        )}
      >
        {iniciales(titulo)}
      </div>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Salir</span>
        </button>
      </form>
    </div>
  );
}
