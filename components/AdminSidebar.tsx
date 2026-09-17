"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rss,
  FileStack,
  Tags,
  ArrowLeftRight,
  Building2,
  UserCheck,
  Users,
  ClipboardList,
  Layers,
  CreditCard,
  Sparkles,
  ShieldAlert,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Grupo = {
  titulo: string;
  enlaces: Array<{ href: string; label: string; icon: React.ElementType; exacto?: boolean }>;
};

const grupos: Grupo[] = [
  {
    titulo: "General",
    enlaces: [{ href: "/admin", label: "Panel general", icon: LayoutDashboard, exacto: true }],
  },
  {
    titulo: "Convocatorias",
    enlaces: [
      { href: "/admin/convocatorias", label: "Convocatorias", icon: FileStack },
      { href: "/admin/fuentes", label: "Fuentes", icon: Rss },
      { href: "/admin/categorias", label: "Categorías", icon: Tags },
    ],
  },
  {
    titulo: "Consultores",
    enlaces: [
      { href: "/admin/consultores/revision", label: "Perfiles en revisión", icon: UserCheck },
      { href: "/admin/consultores", label: "Consultores", icon: Users },
      { href: "/admin/encargos", label: "Encargos por asignar", icon: ClipboardList },
    ],
  },
  {
    titulo: "Suscripciones",
    enlaces: [
      { href: "/admin/planes", label: "Planes", icon: Layers },
      { href: "/admin/suscripciones", label: "Suscripciones", icon: CreditCard },
    ],
  },
  {
    titulo: "Inteligencia artificial",
    enlaces: [{ href: "/admin/plantillas", label: "Plantillas de generación", icon: Sparkles }],
  },
  {
    titulo: "Seguridad",
    enlaces: [{ href: "/admin/seguridad", label: "Eventos y bloqueos", icon: ShieldAlert }],
  },
];

// Solo el Propietario ve la sección; a los demás el servidor les responde 404 (RF-86).
const grupoPropietario: Grupo = {
  titulo: "Propietario",
  enlaces: [{ href: "/admin/administradores", label: "Administradores", icon: UserCog }],
};

export function AdminSidebar({ esPropietario }: { esPropietario: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-primary-950 text-white">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
          <Building2 className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-bold">Panel admin</p>
          <p className="text-xs text-white/50">Gestión de Convocatorias</p>
        </div>
      </div>

      <nav className="flex-1 space-y-5 px-3 py-4">
        {(esPropietario ? [...grupos, grupoPropietario] : grupos).map((grupo) => (
          <div key={grupo.titulo}>
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-white/35">
              {grupo.titulo}
            </p>
            <div className="space-y-1">
              {grupo.enlaces.map(({ href, label, icon: Icon, exacto }) => {
                const activo = exacto ? pathname === href : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      activo ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Link
          href="/convocatorias"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeftRight className="h-4 w-4" strokeWidth={2} />
          Ir al portal de usuario
        </Link>
      </div>
    </aside>
  );
}
