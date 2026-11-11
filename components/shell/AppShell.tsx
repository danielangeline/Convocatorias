"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { gruposDeRol, itemActivo, type GrupoMenu, type RolShell } from "./menus";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { TabsInferiores } from "./TabsInferiores";
import type { Notificacion } from "@/lib/notificaciones-empresa";

/**
 * Shell común de los tres portales. Escritorio (≥ 1024 px): menú lateral de
 * 252 px y barra superior. Móvil: sin menú lateral y con pestañas inferiores
 * (empresa y consultor) o un drawer con hamburguesa (panel admin).
 * Es solo presentación; el rol y los datos los resuelve cada layout en el
 * servidor (`exigirRol`). `contadores` va por href del ítem.
 */
export function AppShell({
  rol,
  grupos: gruposPropios,
  contadores = {},
  ancho = "max-w-[1200px]",
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
  const esAdmin = rol === "administrador";
  const [movil, setMovil] = useState(false);

  // El drawer del panel cierra con Esc.
  useEffect(() => {
    if (!movil) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMovil(false);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [movil]);

  return (
    <div className="flex min-h-screen bg-bg text-[14px] text-ink">
      {/* Escritorio: menú fijo. */}
      <aside className="sticky top-0 hidden h-screen w-[252px] flex-none border-r border-line lg:block">
        <Sidebar
          rol={rol}
          grupos={grupos}
          pathname={pathname}
          consulta={consulta}
          contadores={contadores}
          alNavegar={() => {}}
        />
      </aside>

      {/* Panel admin en móvil (< 1024 px): drawer con overlay. */}
      {esAdmin && movil && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setMovil(false)} aria-hidden />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="absolute left-0 top-0 h-full w-[264px] max-w-[85%] border-r border-line shadow-card"
          >
            <Sidebar
              rol={rol}
              grupos={grupos}
              pathname={pathname}
              consulta={consulta}
              contadores={contadores}
              alNavegar={() => setMovil(false)}
            />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          grupo={activo?.grupo.titulo ?? ""}
          pantalla={activo?.item.label ?? ""}
          conBusqueda={rol === "empresa"}
          alAbrirMovil={esAdmin ? () => setMovil(true) : undefined}
          conSalida={rol === "consultor"}
          notificaciones={notificaciones}
        />
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col px-4 pt-5 sm:px-7 lg:pt-7",
            esAdmin ? "pb-12" : "pb-24 lg:pb-14",
            ancho
          )}
        >
          {children}
        </div>
      </div>

      {!esAdmin && <TabsInferiores rol={rol} activoHref={activo?.item.href} contadores={contadores} />}
    </div>
  );
}
