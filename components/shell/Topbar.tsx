"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Menu, PanelLeft, Search } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({
  grupo,
  pantalla,
  conBusqueda,
  alContraer,
  alAbrirMovil,
}: {
  grupo: string;
  pantalla: string;
  /** Solo el portal Empresa tiene catálogo que buscar. */
  conBusqueda: boolean;
  alContraer: () => void;
  alAbrirMovil: () => void;
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

  const boton =
    "grid h-[34px] w-[34px] flex-none cursor-pointer place-items-center rounded-[9px] border border-line bg-surface text-ink-2 hover:text-ink";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-[color-mix(in_oklch,var(--bg)_82%,transparent)] px-4 backdrop-blur-md sm:px-6">
      <button type="button" onClick={alAbrirMovil} aria-label="Abrir menú" className={`${boton} lg:hidden`}>
        <Menu className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={alContraer}
        title="Contraer menú"
        aria-label="Contraer o expandir el menú"
        className={`${boton} hidden lg:grid`}
      >
        <PanelLeft className="h-4 w-4" />
      </button>
      <div className="flex min-w-[120px] items-center gap-2 overflow-hidden whitespace-nowrap text-[13px]">
        <span className="hidden text-ink-3 sm:inline">{grupo}</span>
        <span className="hidden text-ink-3 sm:inline">/</span>
        <span className="truncate font-bold">{pantalla}</span>
      </div>
      <div className="flex-1" />
      {conBusqueda && (
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            const q = new FormData(e.currentTarget).get("q")?.toString().trim();
            router.push(q ? `/convocatorias?q=${encodeURIComponent(q)}` : "/convocatorias");
          }}
          className="hidden h-9 min-w-[140px] flex-[0_1_260px] items-center gap-2 rounded-[10px] border border-line bg-surface pl-3 pr-2.5 text-ink-3 focus-within:border-pri sm:flex"
        >
          <Search className="h-[15px] w-[15px] flex-none" />
          <input
            ref={campo}
            name="q"
            aria-label="Buscar convocatorias"
            placeholder="Buscar convocatorias…"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none"
          />
          <kbd className="font-tabular rounded-[5px] border border-line bg-surface-2 px-1.5 py-0.5 text-[11px]">⌘K</kbd>
        </form>
      )}
      <ThemeToggle />
    </header>
  );
}
