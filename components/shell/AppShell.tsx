"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { gruposDeRol, itemActivo, type GrupoMenu, type RolShell } from "./menus";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useAlmacenLocal } from "./useAlmacenLocal";
import type { Notificacion } from "@/lib/notificaciones-empresa";

/**
 * Shell común de los tres portales: menú lateral agrupado y barra superior.
 * Es solo presentación; el rol y los datos los resuelve cada layout en el
 * servidor (`exigirRol`). `contadores` va por href del ítem.
 */
export function AppShell({
  rol,
  grupos: gruposPropios,
  contadores = {},
  ancho = "max-w-[1360px]",
  notificaciones,
  children,
}: {
  rol: RolShell;
  /** El panel pasa su menú (`AdminShell`); el portal usa el de su rol. */
  grupos?: GrupoMenu[];
  contadores?: Record<string, number>;
  ancho?: string;
  /** Solo el portal Empresa tiene avisos (RF-105); sin la prop no hay campana. */
  notificaciones?: Notificacion[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const grupos = gruposPropios ?? gruposDeRol(rol === "administrador" ? "empresa" : rol);
  const consulta = useSearchParams().toString();
  const activo = itemActivo(grupos, pathname, consulta);
  const [contraidoRaw, fijarContraido] = useAlmacenLocal("shell:contraido", "0");
  const contraido = contraidoRaw === "1";
  const [movil, setMovil] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg text-[14px] text-ink">
      {/* Escritorio: menú fijo. */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-none border-r border-line transition-[width] duration-[220ms] lg:block",
          contraido ? "w-[76px]" : "w-[264px]"
        )}
      >
        <Sidebar
          rol={rol}
          grupos={grupos}
          pathname={pathname}
          consulta={consulta}
          contadores={contadores}
          contraido={contraido}
          alNavegar={() => {}}
        />
      </aside>

      {/* Móvil (<1024 px): drawer con overlay. */}
      {movil && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMovil(false)} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute left-0 top-0 h-full w-[264px] max-w-[85%] border-r border-line"
          >
            <Sidebar
              rol={rol}
              grupos={grupos}
              pathname={pathname}
          consulta={consulta}
              contadores={contadores}
              contraido={false}
              alNavegar={() => setMovil(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          grupo={activo?.grupo.titulo ?? "Convocatorias"}
          pantalla={activo?.item.label ?? ""}
          conBusqueda={rol === "empresa"}
          alContraer={() => fijarContraido(contraido ? "0" : "1")}
          alAbrirMovil={() => setMovil(true)}
          notificaciones={notificaciones}
        />
        <div className={cn("mx-auto flex w-full flex-1 flex-col px-4 pb-12 pt-6 sm:px-7 sm:pt-7", ancho)}>
          {children}
        </div>
      </div>
    </div>
  );
}
