"use client";

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import { usePlanEfectivo } from "@/lib/hooks";
import { FUNCIONES, nombreCortoPlan } from "@/lib/planes";
import type { FuncionPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * RF-120 · Una función que el plan efectivo no incluye (RN-41) se ve, no se
 * esconde: la pantalla explica qué hace, en qué plan está y lleva a mejorar el
 * plan con ese plan señalado. El plan que la incluye sale de los datos de los
 * planes. Solo informa: el servidor rechaza con `funcion_no_incluida`.
 */
function useDestino(funcion: FuncionPlan) {
  const { planPara } = usePlanEfectivo();
  const plan = planPara(funcion);
  return {
    nombre: plan ? nombreCortoPlan(plan.nombre) : null,
    href: plan ? `/suscripcion?plan=${plan.id}#plan-${plan.id}` : "/suscripcion",
  };
}

export function PantallaBloqueada({
  funcion,
  titulo,
  children,
}: {
  funcion: FuncionPlan;
  /** El nombre de la pantalla, p. ej. «Postulaciones». */
  titulo: string;
  /** Lo que la empresa ya tiene de esta función, en solo lectura. */
  children?: React.ReactNode;
}) {
  const destino = useDestino(funcion);
  const f = FUNCIONES[funcion];
  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      <section
        aria-labelledby="titulo-bloqueo"
        className="rounded-md border border-line bg-surface p-6 sm:p-8"
        data-funcion-bloqueada={funcion}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-pri-soft text-pri-text">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-ink-3">{titulo}</p>
            <h1 id="titulo-bloqueo" className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">
              {destino.nombre ? `Disponible en el plan ${destino.nombre}` : "No incluida en su plan"}
            </h1>
            <p className="mt-3 max-w-2xl text-[15px] leading-[1.6] text-ink-2">{f.explicacion}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href={destino.href}
                className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-pri px-5 text-sm font-semibold text-on-pri hover:bg-pri-hover"
              >
                Mejorar plan <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/suscripcion" className="text-sm font-semibold text-pri-text underline-offset-2 hover:underline">
                Comparar planes
              </Link>
            </div>
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}

/** Aviso en línea: sobre un listado en solo lectura o en lugar de un botón. */
export function AvisoFuncionBloqueada({
  funcion,
  texto,
  className,
}: {
  funcion: FuncionPlan;
  texto?: string;
  className?: string;
}) {
  const destino = useDestino(funcion);
  return (
    <div
      role="status"
      data-funcion-bloqueada={funcion}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2",
        className
      )}
    >
      <Lock className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      <p className="min-w-0 flex-1">
        {texto ?? FUNCIONES[funcion].titulo}
        {" · "}
        <span className="font-semibold text-ink">
          {destino.nombre ? `Disponible en el plan ${destino.nombre}` : "No incluida en su plan"}
        </span>
      </p>
      <Link href={destino.href} className="font-semibold text-pri-text underline underline-offset-2">
        Mejorar plan
      </Link>
    </div>
  );
}

/** Diálogo en lugar de la acción: «Postular», «Generar», «Solicitar consultor»… */
export function DialogoFuncionBloqueada({ funcion, onCerrar }: { funcion: FuncionPlan; onCerrar: () => void }) {
  const destino = useDestino(funcion);
  const f = FUNCIONES[funcion];
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay p-4" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-dialogo-bloqueo"
        data-funcion-bloqueada={funcion}
        className="w-full max-w-md rounded-md border border-line bg-surface p-6 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-pri-soft text-pri-text">
            <Lock className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-ink-3">{f.titulo}</p>
            <h2 id="titulo-dialogo-bloqueo" className="mt-0.5 font-display text-lg font-semibold text-ink">
              {destino.nombre ? `Disponible en el plan ${destino.nombre}` : "No incluida en su plan"}
            </h2>
          </div>
        </div>
        <p className="mt-4 text-sm leading-[1.6] text-ink-2">{f.explicacion}</p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="inline-flex h-11 cursor-pointer items-center rounded-[4px] px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2"
          >
            Ahora no
          </button>
          <Link
            href={destino.href}
            className="inline-flex h-11 items-center gap-2 rounded-[4px] bg-pri px-5 text-sm font-semibold text-on-pri hover:bg-pri-hover"
          >
            Mejorar plan <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
