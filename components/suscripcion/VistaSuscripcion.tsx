"use client";

import { useState } from "react";
import { CreditCard, Receipt, Check, Sparkles, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion, useTarifas } from "@/lib/hooks";
import type { Pago, RolPlan } from "@/lib/types";
import { cn, formatCOP, formatFecha, ESTADO_SUSCRIPCION_LABEL, ESTADO_SUSCRIPCION_ESTILO } from "@/lib/utils";
import { beneficiosDePlan, CONTRATAR_EN_PILOTO } from "@/lib/planes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BloqueCreditos } from "@/components/BloqueCreditos";

/**
 * CU-28 · CU-30 · RF-41, RF-82 · "Mi suscripción" de la empresa y del consultor.
 *
 * Plan, estado y fechas vienen de la sesión; los planes activos del rol y el
 * historial de pagos, del servidor (docs/05 §9.28). El cupo de créditos solo
 * aparece en los planes que lo incluyen (RF-41): el consultor no lo tiene
 * (RN-28). En el piloto no se contrata desde aquí (CU-28 paso 3).
 */
export function VistaSuscripcion({ rol, pagos }: { rol: RolPlan; pagos: Pago[] }) {
  const tarifaDocumento = useTarifas().generacion;
  const { suscripcion, diasRestantes } = useAccesoSuscripcion();
  const planes = useAppStore((s) => s.planes);
  const [modalidad, setModalidad] = useState<"mensual" | "anual">("mensual");
  const [elegido, setElegido] = useState<string | null>(null);

  const planActual = suscripcion ? planes.find((p) => p.id === suscripcion.planId) : undefined;
  const disponibles = planes.filter((p) => p.rol === rol && !p.esTrial && p.activo !== false);
  const vencida = suscripcion?.estado === "vencida" || suscripcion?.estado === "suspendida";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Mi suscripción</h1>
        <p className="text-sm text-ink-2">
          {rol === "empresa" ? "El plan de tu empresa en la plataforma." : "Tu plan como consultor en la plataforma."}
        </p>
      </div>

      <div className="rounded-2xl border border-line p-6 bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
              <CreditCard className="h-3.5 w-3.5" /> Plan actual
            </p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{planActual?.nombre ?? "Sin plan activo"}</p>
            {suscripcion && suscripcion.modalidad !== "trial" && (
              <p className="text-sm text-ink-2">
                {suscripcion.modalidad === "anual" ? "Anual" : "Mensual"} · desde el {formatFecha(suscripcion.fechaInicio)}
              </p>
            )}
          </div>
          {suscripcion && (
            <div className="flex items-center gap-3">
              <Badge className={ESTADO_SUSCRIPCION_ESTILO[suscripcion.estado]}>{ESTADO_SUSCRIPCION_LABEL[suscripcion.estado]}</Badge>
              <div className="text-right text-sm">
                <p className="text-ink-3">{suscripcion.estado === "vencida" ? "Venció el" : "Vence el"}</p>
                <p className="font-medium text-ink">{formatFecha(suscripcion.fechaVencimiento)}</p>
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-sm text-ink-2">
          {!suscripcion
            ? rol === "consultor"
              ? "Aún no tienes un plan. Mientras dure el piloto, puedes aparecer en el directorio y recibir encargos sin él."
              : "No tienes un plan activo."
            : suscripcion.estado === "suspendida"
              ? "Tu suscripción está suspendida. Escríbenos para reactivarla."
              : suscripcion.estado === "vencida"
                ? rol === "empresa"
                  ? "Tu suscripción está vencida: no puedes postular, ver sugerencias, solicitar consultores ni generar documentos con IA. El catálogo sigue disponible."
                  : "Tu suscripción está vencida."
                : diasRestantes !== null && diasRestantes >= 0
                  ? `Te quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de ${suscripcion.modalidad === "trial" ? "periodo de prueba" : "vigencia"}.`
                  : null}
        </p>
      </div>

      {rol === "empresa" && <BloqueCreditos />}

      <div className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold text-ink">Planes disponibles</h2>
          <div className="flex items-center gap-1 rounded-lg bg-surface-2 p-1 text-sm font-semibold" role="group" aria-label="Modalidad">
            {(["mensual", "anual"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modalidad === m}
                onClick={() => setModalidad(m)}
                className={cn("rounded-md px-3 py-1 transition-colors", modalidad === m ? "bg-surface text-pri-text shadow-sm" : "text-ink-2")}
              >
                {m === "mensual" ? "Mensual" : "Anual"}
              </button>
            ))}
          </div>
        </div>

        {disponibles.length === 0 ? (
          <p className="text-sm text-ink-3">No hay planes disponibles en este momento.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {disponibles.map((plan) => {
              const precio = modalidad === "anual" ? plan.precioAnual : plan.precioMensual;
              const ahorro = plan.precioMensual * 12 - plan.precioAnual;
              const esActual = planActual?.id === plan.id && !vencida;
              return (
                <div key={plan.id} className={cn("flex flex-col rounded-2xl border p-5", esActual ? "border-pri ring-1 ring-pri-soft" : "border-line")}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-ink">{plan.nombre}</h3>
                    {esActual && <Badge className="bg-pri-soft text-pri-text ring-pri-soft">Tu plan</Badge>}
                  </div>
                  <p className="mt-2">
                    <span className="font-tabular text-2xl font-bold text-pri-text">{formatCOP(precio)}</span>
                    <span className="text-sm text-ink-3"> / {modalidad === "anual" ? "año" : "mes"}</span>
                  </p>
                  {modalidad === "anual" && ahorro > 0 && (
                    <p className="text-xs font-semibold text-amber-ink">Ahorras {formatCOP(ahorro)} frente a pagar mes a mes</p>
                  )}
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-2">
                    {beneficiosDePlan(plan, tarifaDocumento).map((b) => (
                      <li key={b.texto} className={cn("flex items-start gap-2", b.destacado && "font-semibold text-violet-ink")}>
                        {b.destacado ? <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pri-text" />}
                        {b.texto}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={esActual ? "secondary" : "primary"}
                    className="mt-5 w-full"
                    disabled={esActual}
                    onClick={() => setElegido(plan.id)}
                  >
                    {esActual ? "Plan actual" : "Quiero este plan"}
                  </Button>
                  {elegido === plan.id && (
                    <p role="status" className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {CONTRATAR_EN_PILOTO}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Receipt className="h-4 w-4" /> Historial de pagos
        </h2>
        {pagos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">Aún no hay pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs font-semibold uppercase tracking-wide text-ink-3">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Concepto</th>
                  <th className="px-5 py-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-2">
                {pagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-ink-2">{formatFecha(p.fecha)}</td>
                    <td className="px-5 py-3 text-ink-2">
                      {p.concepto === "paquete"
                        ? `Paquete de ${p.creditos} créditos de IA`
                        : `${p.planNombre ?? "Plan"}${p.modalidad ? ` · ${p.modalidad}` : ""}`}
                    </td>
                    <td className="px-5 py-3 text-right font-tabular font-medium text-ink">
                      {p.monto === 0 ? "Cortesía" : formatCOP(p.monto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
