"use client";

import Link from "next/link";
import { ChevronDown, LogOut, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCreditos } from "@/lib/hooks";
import { cerrarSesion } from "@/lib/acciones/auth";
import { cn } from "@/lib/utils";
import { CreditMeter } from "@/components/viz/CreditMeter";
import { itemActivo, PORTAL, type GrupoMenu, type RolShell } from "./menus";
import { useAlmacenLocal } from "./useAlmacenLocal";

function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

function Contador({ n, contraido }: { n: number; contraido: boolean }) {
  if (n <= 0) return null;
  if (contraido) {
    return <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose" aria-label={`${n} pendientes`} />;
  }
  return (
    <span
      className="font-tabular grid h-5 min-w-5 place-items-center rounded-full bg-rose px-1.5 text-[11px] font-semibold text-white"
      aria-label={`${n} pendientes`}
    >
      {n}
    </span>
  );
}

function PieEmpresa() {
  const { plan, disponibles, incluidos, extra, suscripcion } = useCreditos();
  const abrir = useAppStore((s) => s.abrirModalCreditos);
  if (!suscripcion) return null;
  return (
    <button
      type="button"
      onClick={() => abrir()}
      title="Créditos de IA: ver cómo conseguir más"
      className="cursor-pointer rounded-xl text-left"
    >
      <CreditMeter
        plan={`Plan ${plan?.nombre ?? ""}`.trim()}
        usados={disponibles}
        total={Math.max(incluidos + extra, disponibles)}
        nota="Créditos de IA disponibles"
      />
    </button>
  );
}

export function Sidebar({
  rol,
  grupos,
  pathname,
  contadores,
  contraido,
  alNavegar,
}: {
  rol: RolShell;
  grupos: GrupoMenu[];
  pathname: string;
  contadores: Record<string, number>;
  contraido: boolean;
  alNavegar: () => void;
}) {
  const sesion = useAppStore((s) => s.sesion);
  const [cerradosRaw, fijarCerrados] = useAlmacenLocal(`shell:${rol}:grupos-cerrados`, "");
  const cerrados = new Set(cerradosRaw.split(",").filter(Boolean));
  const activo = itemActivo(grupos, pathname);

  const alternar = (id: string) => {
    const nuevo = new Set(cerrados);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    fijarCerrados([...nuevo].join(","));
  };

  const titulo = sesion ? (sesion.nombreEmpresa ?? sesion.nombre) : "";
  const subtitulo = sesion ? (sesion.nombreEmpresa ? sesion.nombre : sesion.rol === "administrador" ? "Administrador" : "Consultor") : "";

  return (
    <div className="flex h-full flex-col bg-side">
      <div className="flex min-h-[70px] items-center gap-2.5 px-4 pb-4 pt-[18px]">
        <Link
          href={grupos[0]?.items[0]?.href ?? "/"}
          onClick={alNavegar}
          className="relative grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[10px] bg-pri text-on-pri"
          aria-label="Convocatorias"
        >
          <span className="absolute left-1.5 top-1.5 h-[22px] w-[22px] rounded-full border-[3px] border-current opacity-95" />
          <span className="absolute right-[5px] top-[5px] h-[9px] w-[9px] rounded-full bg-current" />
        </Link>
        {!contraido && (
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold leading-[1.1] tracking-[-0.01em]">Convocatorias</div>
            <div className="mt-[3px] text-[11.5px] text-ink-3">{PORTAL[rol]}</div>
          </div>
        )}
      </div>

      <nav aria-label="Menú principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3 pt-1 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]">
        {grupos.map((g, i) => {
          const cerrado = !contraido && cerrados.has(g.id);
          const suma = g.items.reduce((s, it) => s + (contadores[it.href] ?? 0), 0);
          return (
            <div key={g.id} className="flex flex-col gap-0.5 px-2.5">
              {contraido ? (
                i > 0 && <div className="mx-2.5 my-[9px] h-px bg-line" />
              ) : (
                <button
                  type="button"
                  onClick={() => alternar(g.id)}
                  aria-expanded={!cerrado}
                  className="flex w-full cursor-pointer items-center justify-between bg-transparent px-2.5 pb-[7px] pt-3.5 text-[10.5px] font-bold uppercase tracking-[.09em] text-ink-3 hover:text-ink"
                >
                  <span className="flex items-center gap-2">
                    {g.titulo}
                    {cerrado && suma > 0 && (
                      <span className="grid h-4 min-w-4 place-items-center rounded-lg bg-rose px-[5px] text-[10px] tracking-normal text-white">
                        {suma}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", cerrado && "-rotate-90")} />
                </button>
              )}
              {!cerrado &&
                g.items.map((it) => {
                  const esActivo = activo?.item.href === it.href;
                  const Icono = it.icono;
                  return (
                    <Link
                      key={it.href}
                      href={it.href}
                      onClick={alNavegar}
                      title={it.label}
                      aria-current={esActivo ? "page" : undefined}
                      className={cn(
                        "relative flex h-[38px] items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition-colors",
                        contraido && "justify-center px-0",
                        esActivo
                          ? "bg-pri-soft font-bold text-pri-text"
                          : "font-semibold text-ink-2 hover:text-ink"
                      )}
                    >
                      <Icono className="h-[17px] w-[17px] flex-none" />
                      {!contraido && <span className="flex-1 truncate">{it.label}</span>}
                      <Contador n={contadores[it.href] ?? 0} contraido={contraido} />
                    </Link>
                  );
                })}
            </div>
          );
        })}
      </nav>

      <div className="flex flex-col gap-2.5 border-t border-line p-3">
        {rol === "empresa" && !contraido && <PieEmpresa />}
        {rol === "empresa" && contraido && (
          <button
            type="button"
            onClick={() => useAppStore.getState().abrirModalCreditos()}
            title="Créditos de IA"
            className="mx-auto grid h-[38px] w-[38px] cursor-pointer place-items-center rounded-[10px] bg-surface-2 text-violet"
          >
            <Sparkles className="h-4 w-4" />
          </button>
        )}
        {sesion && (
          <div className={cn("flex items-center gap-2.5", contraido && "flex-col")}>
            <div
              title={`${titulo} · ${sesion.correo}`}
              className="grid h-[34px] w-[34px] flex-none place-items-center rounded-full bg-pri-soft text-xs font-extrabold text-pri-text"
            >
              {iniciales(titulo)}
            </div>
            {!contraido && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-bold">{titulo}</div>
                <div className="truncate text-[11.5px] text-ink-3">{subtitulo}</div>
              </div>
            )}
            <form action={cerrarSesion}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="grid h-[30px] w-[30px] cursor-pointer place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
