"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Ellipsis, Lock, LogOut } from "lucide-react";
import { usePlanEfectivo } from "@/lib/hooks";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { cerrarSesion } from "@/lib/acciones/auth";
import { cn } from "@/lib/utils";
import { tabsDeRol, type ItemMenu } from "./menus";

/**
 * Barra de pestañas inferior del móvil (< 1024 px). Empresa: Inicio · Buscar ·
 * Postular · Proyectos · Más (la hoja con el resto del menú). Consultor: 4
 * pestañas. `activoHref` es el href del ítem activo del menú.
 */
export function TabsInferiores({
  rol,
  activoHref,
  contadores,
}: {
  rol: "empresa" | "consultor";
  activoHref?: string;
  contadores: Record<string, number>;
}) {
  const { tabs, mas } = tabsDeRol(rol);
  const { incluye } = usePlanEfectivo();
  // RF-120: la función que el plan no incluye sigue visible, con candado.
  const bloqueado = (i: ItemMenu) => !!i.funcion && !incluye(i.funcion);
  const [abierta, setAbierta] = useState(false);
  const conMas = mas.length > 0;
  const masActivo = conMas && !!activoHref && mas.some((i) => i.href === activoHref);
  const columnas = tabs.length + (conMas ? 1 : 0);

  const pestana = (activo: boolean) =>
    cn(
      "relative flex min-h-[58px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors",
      activo ? "text-pri-text" : "text-ink-3 hover:text-ink"
    );
  const barra = (activo: boolean) =>
    activo && <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 rounded-b-[2px] bg-pri" />;

  return (
    <>
      <nav
        aria-label="Navegación principal"
        style={{ gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {tabs.map((t: ItemMenu) => {
          const activo = activoHref === t.href;
          const Icono = t.icono;
          const n = contadores[t.href] ?? 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              data-recorrido={t.href}
              aria-current={activo ? "page" : undefined}
              className={pestana(activo)}
            >
              {barra(activo)}
              <span className="relative">
                <Icono className="h-[21px] w-[21px]" aria-hidden />
                {bloqueado(t) ? (
                  <Lock className="absolute -right-2 -top-1 h-3 w-3 text-ink-3" aria-label="Función bloqueada en su plan" />
                ) : n > 0 && (
                  <span
                    className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-amber"
                    aria-label={`${n} pendientes`}
                  />
                )}
              </span>
              {t.etiquetaTab ?? t.label}
            </Link>
          );
        })}
        {conMas && (
          <button
            type="button"
            onClick={() => setAbierta(true)}
            aria-haspopup="dialog"
            aria-expanded={abierta}
            className={cn(pestana(masActivo), "cursor-pointer")}
          >
            {barra(masActivo)}
            <Ellipsis className="h-[21px] w-[21px]" aria-hidden />
            Más
          </button>
        )}
      </nav>

      {conMas && (
        <BottomSheet abierto={abierta} onCerrar={() => setAbierta(false)} titulo="Más">
          <ul className="m-0 list-none p-0">
            {mas.map((i) => {
              const Icono = i.icono;
              const activo = activoHref === i.href;
              return (
                <li key={i.href} className="border-b border-line-2">
                  <Link
                    href={i.href}
                    onClick={() => setAbierta(false)}
                    aria-current={activo ? "page" : undefined}
                    className={cn(
                      "flex min-h-[52px] items-center gap-3 px-5 text-[15px] font-semibold",
                      activo ? "bg-pri-soft text-pri-text" : "text-ink hover:bg-surface-2"
                    )}
                  >
                    <Icono className="h-5 w-5 flex-none text-ink-3" aria-hidden />
                    <span className="flex-1">{i.label}</span>
                    {bloqueado(i) && <Lock className="h-4 w-4 text-ink-3" aria-label="Función bloqueada en su plan" />}
                    <ChevronRight className="h-4 w-4 text-ink-3" aria-hidden />
                  </Link>
                </li>
              );
            })}
            <li>
              <form action={cerrarSesion}>
                <button
                  type="submit"
                  className="flex min-h-[52px] w-full cursor-pointer items-center gap-3 px-5 text-left text-[15px] font-semibold text-rose hover:bg-rose-soft"
                >
                  <LogOut className="h-5 w-5 flex-none" aria-hidden />
                  Cerrar sesión
                </button>
              </form>
            </li>
          </ul>
        </BottomSheet>
      )}
    </>
  );
}
