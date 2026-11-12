"use client";

import Link from "next/link";
import { Lock, LogOut } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCreditos, usePlanEfectivo, useTarifas } from "@/lib/hooks";
import { nombreCortoPlan } from "@/lib/planes";
import { cerrarSesion } from "@/lib/acciones/auth";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { itemActivo, PORTAL, type GrupoMenu, type RolShell } from "./menus";

function iniciales(texto: string): string {
  const partes = texto.trim().split(/\s+/).filter(Boolean);
  return (partes[0]?.[0] ?? "?").concat(partes[1]?.[0] ?? "").toUpperCase();
}

/** Contador ámbar (el "ping" del menú): el texto sobre ámbar siempre es la tinta oscura. */
function Contador({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      className="font-tabular grid h-5 min-w-5 place-items-center rounded-full bg-amber px-1.5 text-[11px] font-medium text-[#0a1a22]"
      aria-label={`${n} pendientes`}
    >
      {n}
    </span>
  );
}

/** Tarjeta de créditos del pie: siempre en documentos, con la tarifa real (RF-100). */
function PieEmpresa() {
  const { disponibles, incluidos, extra, suscripcion } = useCreditos();
  const tarifaDocumento = useTarifas().generacion;
  const abrir = useAppStore((s) => s.abrirModalCreditos);
  const { planEfectivo, planPara } = usePlanEfectivo();
  if (!suscripcion) return null;
  // RN-41: sin IA en el plan (Gratis), la tarjeta invita a mejorar en lugar de contar créditos.
  if (planEfectivo && !planEfectivo.funciones.documento_ia && !planEfectivo.funciones.proyecto_ia) {
    const plan = planPara("documento_ia");
    return (
      <Link
        href={plan ? `/suscripcion?plan=${plan.id}` : "/suscripcion"}
        data-recorrido="creditos"
        className="block w-full rounded-md border border-line bg-surface-2 p-3 text-left hover:border-pri"
      >
        <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-2">
          <span>Plan {planEfectivo.nombre}</span>
          <Lock className="h-3.5 w-3.5 text-ink-3" aria-hidden />
        </div>
        <p className="mt-2 text-xs text-ink-3">
          La IA está disponible desde el plan {plan ? nombreCortoPlan(plan.nombre) : "de pago"}. <span className="font-semibold text-pri-text">Mejorar plan</span>
        </p>
      </Link>
    );
  }
  const total = Math.max(incluidos + extra, disponibles);
  const pct = total > 0 ? Math.min(100, (disponibles / total) * 100) : 0;
  const documentos = tarifaDocumento > 0 ? Math.floor(disponibles / tarifaDocumento) : 0;
  return (
    <button
      type="button"
      onClick={() => abrir()}
      title="Créditos de IA: ver cómo conseguir más"
      data-recorrido="creditos"
      className="w-full cursor-pointer rounded-md border border-line bg-surface-2 p-3 text-left hover:border-pri"
    >
      <div className="flex items-baseline justify-between gap-2 text-xs font-semibold text-ink-2">
        <span>Créditos de IA</span>
        <span className="font-tabular text-ink">
          {disponibles.toLocaleString("es-CO")} / {total.toLocaleString("es-CO")}
        </span>
      </div>
      <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-line-2">
        <div className="h-full rounded-full bg-pri" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-3">
        Te alcanzan para {documentos.toLocaleString("es-CO")} {documentos === 1 ? "documento" : "documentos"}
      </p>
    </button>
  );
}

export function Sidebar({
  rol,
  grupos,
  pathname,
  consulta,
  contadores,
  alNavegar,
}: {
  rol: RolShell;
  grupos: GrupoMenu[];
  pathname: string;
  consulta: string;
  contadores: Record<string, number>;
  alNavegar: () => void;
}) {
  const sesion = useAppStore((s) => s.sesion);
  const { incluye, planPara } = usePlanEfectivo();
  const activo = itemActivo(grupos, pathname, consulta);

  const titulo = sesion ? (sesion.nombreEmpresa ?? sesion.nombre) : "";
  const subtitulo = sesion ? (sesion.nombreEmpresa ? sesion.nombre : sesion.rol === "administrador" ? "Administrador" : "Consultor") : "";

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="px-5 pb-3.5 pt-5">
        <Link href={grupos[0]?.items[0]?.href ?? "/"} onClick={alNavegar} aria-label="FundRadar, ir al inicio">
          <Logo subtitulo={PORTAL[rol]} />
        </Link>
      </div>

      <nav
        aria-label="Menú principal"
        className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3 [scrollbar-color:var(--line)_transparent] [scrollbar-width:thin]"
      >
        {grupos.map((g) => (
          <div key={g.id} className="flex flex-col gap-0.5">
            {g.titulo && (
              <div className="px-2.5 pb-1.5 pt-4 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">
                {g.titulo}
              </div>
            )}
            {g.items.map((it) => {
              const esActivo = activo?.item.href === it.href;
              const Icono = it.icono;
              // RF-120: bloqueada pero visible, con candado y el plan que la incluye.
              const bloqueado = !!it.funcion && !incluye(it.funcion);
              const planDe = bloqueado && it.funcion ? planPara(it.funcion) : null;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={alNavegar}
                  data-recorrido={it.href}
                  aria-current={esActivo ? "page" : undefined}
                  title={bloqueado ? `Disponible en el plan ${planDe ? nombreCortoPlan(planDe.nombre) : "de pago"}` : undefined}
                  className={cn(
                    "flex h-10 items-center gap-2.5 rounded-[4px] px-2.5 text-sm transition-colors",
                    esActivo
                      ? "bg-pri-soft font-semibold text-pri-text"
                      : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
                  )}
                >
                  <Icono className="h-[18px] w-[18px] flex-none" aria-hidden />
                  <span className="flex-1 truncate">{it.label}</span>
                  {bloqueado ? (
                    <Lock className="h-3.5 w-3.5 flex-none text-ink-3" aria-label="Función bloqueada en su plan" />
                  ) : (
                    <Contador n={contadores[it.href] ?? 0} />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-line p-3">
        {rol === "empresa" && <PieEmpresa />}
        {sesion && (
          <div className="flex items-center gap-2.5">
            <div
              title={`${titulo} · ${sesion.correo}`}
              className="grid h-9 w-9 flex-none place-items-center rounded-full bg-pri-soft text-xs font-bold text-pri-text"
            >
              {iniciales(titulo)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-ink">{titulo}</div>
              <div className="truncate text-xs text-ink-3">{subtitulo}</div>
            </div>
            <form action={cerrarSesion}>
              <button
                type="submit"
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] text-ink-3 hover:bg-surface-2 hover:text-ink"
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
