"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search } from "lucide-react";
import { cerrarSesion } from "@/lib/acciones/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Notificaciones } from "./Notificaciones";
import { Logo } from "./Logo";
import type { Notificacion } from "@/lib/notificaciones-empresa";

/**
 * Barra superior de 60 px con desenfoque. Escritorio: miga, búsqueda de 280 px,
 * tema y campana. Móvil: logo compacto, tema y campana; solo el panel admin
 * lleva hamburguesa (su menú es largo y usa un drawer, no pestañas).
 */
export function Topbar({
  grupo,
  pantalla,
  conBusqueda,
  alAbrirMovil,
  conSalida,
  notificaciones,
}: {
  grupo: string;
  pantalla: string;
  /** Solo el portal Empresa tiene catálogo que buscar. */
  conBusqueda: boolean;
  /** Presente solo en el panel admin: abre su drawer en móvil. */
  alAbrirMovil?: () => void;
  /** Consultor en móvil: sin hoja «Más», la salida va en la barra superior. */
  conSalida?: boolean;
  notificaciones?: Notificacion[];
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center gap-3 border-b border-line bg-topbar px-4 backdrop-blur-[10px] sm:px-7">
      {alAbrirMovil && (
        <button
          type="button"
          onClick={alAbrirMovil}
          aria-label="Abrir menú"
          className="grid h-11 w-11 flex-none cursor-pointer place-items-center rounded-[4px] border border-line-strong bg-surface text-ink-2 hover:text-ink lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}
      <div className="lg:hidden">
        <Logo compacto />
      </div>
      <div className="hidden min-w-[120px] items-center gap-2 overflow-hidden whitespace-nowrap text-[13px] lg:flex">
        {grupo && <span className="text-ink-3">{grupo}</span>}
        {grupo && <span className="text-ink-3">/</span>}
        <span className="truncate font-semibold text-ink">{pantalla}</span>
      </div>
      <div className="flex-1" />
      {conBusqueda && (
        <form
          role="search"
          data-recorrido="buscar"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            router.push(q ? `/convocatorias?q=${encodeURIComponent(q)}` : "/convocatorias");
          }}
          className="hidden h-11 min-w-[140px] flex-[0_1_280px] items-center gap-2 rounded-[4px] border border-line-strong bg-surface pl-3 pr-2.5 text-ink-3 focus-within:border-pri sm:flex"
        >
          <Search className="h-[15px] w-[15px] flex-none" aria-hidden />
          <input
            ref={campo}
            name="q"
            aria-label="Buscar convocatorias"
            placeholder="Buscar en la plataforma…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
          />
          <kbd className="font-tabular rounded-[3px] border border-line bg-surface-2 px-1.5 py-0.5 text-[11px]">⌘K</kbd>
        </form>
      )}
      <ThemeToggle />
      {notificaciones && <Notificaciones avisos={notificaciones} />}
      {conSalida && (
        <form action={cerrarSesion} className="lg:hidden">
          <button
            type="submit"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] border border-line-strong bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      )}
    </header>
  );
}
