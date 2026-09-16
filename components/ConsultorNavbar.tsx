"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { MenuUsuario } from "./MenuUsuario";

const enlaces = [
  { href: "/consultor/perfil", label: "Mi perfil" },
  { href: "/consultor/encargos", label: "Mis encargos" },
  { href: "/consultor/documentos", label: "Mis documentos" },
  { href: "/consultor/suscripcion", label: "Mi suscripción" },
];

export function ConsultorNavbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/consultor/perfil" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brick-500 text-white">
            <HardHat className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="hidden font-display text-[15px] font-bold leading-none text-ink lg:inline">
            Portal de
            <br />
            Consultores
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {enlaces.map((enlace) => {
            const activo = pathname === enlace.href || pathname.startsWith(enlace.href + "/");
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                  activo ? "bg-brick-50 text-brick-700" : "text-ink-soft hover:bg-slate-50 hover:text-ink"
                )}
              >
                {enlace.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-2.5">
          {/* El consultor no tiene cupo propio de IA (RN-28): no hay contador que mostrar. */}
          <MenuUsuario tono="brick" />
        </div>
      </div>
    </header>
  );
}
