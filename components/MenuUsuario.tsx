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
export function MenuUsuario({ tono = "gold" }: { tono?: "gold" | "brick" | "primary" }) {
  const sesion = useAppStore((s) => s.sesion);
  if (!sesion) return null;
  const titulo = sesion.nombreEmpresa ?? sesion.nombre;

  return (
    <div className="flex items-center gap-2">
      <div
        title={`${titulo} · ${sesion.correo}`}
        className={cn(
          "hidden h-9 w-9 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold ring-1 sm:flex",
          tono === "gold" && "bg-gold-50 text-gold-700 ring-gold-100",
          tono === "brick" && "bg-brick-50 text-brick-700 ring-brick-100",
          tono === "primary" && "bg-primary-50 text-primary-800 ring-primary-100"
        )}
      >
        {iniciales(titulo)}
      </div>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-ink-faint hover:bg-slate-50 hover:text-ink"
        >
          <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Salir</span>
        </button>
      </form>
    </div>
  );
}
