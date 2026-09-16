"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuUsuario } from "./MenuUsuario";
import { IndicadorCreditos } from "./IndicadorCreditos";

const enlaces = [
  { href: "/convocatorias", label: "Convocatorias" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/postulaciones", label: "Postulaciones" },
  { href: "/documentos", label: "Documentos" },
  { href: "/consultores", label: "Consultores" },
  { href: "/encargos", label: "Encargos" },
  { href: "/suscripcion", label: "Suscripción" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/convocatorias" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-800 text-white">
            <Building2 className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="hidden font-display text-[15px] font-bold leading-none text-ink lg:inline">
            Gestión de
            <br />
            Convocatorias
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {enlaces.map((enlace) => {
            const activo = pathname === enlace.href || pathname.startsWith(enlace.href + "/");
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={cn(
                  "rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors",
                  activo
                    ? "bg-primary-50 text-primary-800"
                    : "text-ink-soft hover:bg-slate-50 hover:text-ink"
                )}
              >
                {enlace.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          <IndicadorCreditos href="/suscripcion" />
          <MenuUsuario tono="gold" />
        </div>
      </div>

      <nav
        aria-label="Secciones"
        className="barra-desplazable flex items-center gap-1 overflow-x-auto border-t border-line-soft px-4 py-2 md:hidden"
      >
        {enlaces.map((enlace) => {
          const activo = pathname === enlace.href || pathname.startsWith(enlace.href + "/");
          return (
            <Link
              key={enlace.href}
              href={enlace.href}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold",
                activo ? "bg-primary-50 text-primary-800" : "text-ink-soft"
              )}
            >
              {enlace.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
