"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, X, Check, Sparkles, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useTarifas } from "@/lib/hooks";
import { beneficiosDePlan, CONTRATAR_EN_PILOTO } from "@/lib/planes";
import { cn, formatCOP } from "@/lib/utils";

/**
 * CU-32 · Aviso de acción restringida por suscripción. Muestra los planes
 * activos del rol con lo que los diferencia, leído del plan (RF-82). No simula
 * el pago: en el piloto se contrata con el equipo (CU-28 paso 3). Quien
 * restringe es el servidor (RF-40); esto solo explica por qué.
 */
export function ModalSuscripcion() {
  const abierto = useAppStore((s) => s.modalSuscripcionAbierto);
  const motivo = useAppStore((s) => s.motivoModalSuscripcion);
  const cerrar = useAppStore((s) => s.cerrarModalSuscripcion);
  const planes = useAppStore((s) => s.planes);
  const tarifaDocumento = useTarifas().generacion;
  const { rol } = useAccesoSuscripcion();
  const [modalidad, setModalidad] = useState<"mensual" | "anual">("mensual");

  if (!abierto) return null;

  const rolPlan = rol === "consultor" ? "consultor" : "empresa";
  const planesRol = planes.filter((p) => p.rol === rolPlan && !p.esTrial && p.activo !== false);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary-950/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-suscribete" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brick-50 text-brick-600">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 id="titulo-suscribete" className="font-display text-lg font-bold text-ink">Suscríbete para continuar</h2>
              <p className="text-sm text-ink-soft">Necesitas una suscripción activa para {motivo || "continuar"}.</p>
            </div>
          </div>
          <button onClick={cerrar} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold" role="group" aria-label="Modalidad">
          {(["mensual", "anual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={modalidad === m}
              onClick={() => setModalidad(m)}
              className={cn("flex-1 rounded-md px-3 py-1.5 transition-colors", modalidad === m ? "bg-white text-primary-800 shadow-sm" : "text-ink-soft")}
            >
              {m === "mensual" ? "Mensual" : "Anual"}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {planesRol.map((plan) => {
            const precio = modalidad === "anual" ? plan.precioAnual : plan.precioMensual;
            return (
              <div key={plan.id} className="flex flex-col rounded-2xl border border-line p-5">
                <h3 className="font-display text-base font-semibold text-ink">{plan.nombre}</h3>
                <p className="mt-2">
                  <span className="font-tabular text-2xl font-bold text-primary-800">{formatCOP(precio)}</span>
                  <span className="text-sm text-ink-faint"> / {modalidad === "anual" ? "año" : "mes"}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-soft">
                  {beneficiosDePlan(plan, tarifaDocumento).map((b) => (
                    <li key={b.texto} className={cn("flex items-start gap-2", b.destacado && "font-semibold text-teal-700")}>
                      {b.destacado ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />}
                      {b.texto}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-5 flex items-start gap-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          {CONTRATAR_EN_PILOTO}
        </p>
        <div className="mt-4 text-right">
          <Link
            href={rol === "consultor" ? "/consultor/suscripcion" : "/suscripcion"}
            onClick={cerrar}
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            Ver mi suscripción
          </Link>
        </div>
      </div>
    </div>
  );
}
