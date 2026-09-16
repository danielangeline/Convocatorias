"use client";

import { useState } from "react";
import { CreditCard, Receipt, Check, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion } from "@/lib/hooks";
import type { ModalidadSuscripcion } from "@/lib/types";
import {
  cn,
  formatCOP,
  formatFecha,
  ESTADO_SUSCRIPCION_LABEL,
  ESTADO_SUSCRIPCION_ESTILO,
} from "@/lib/utils";
import { beneficiosDePlan } from "@/lib/planes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { BloqueCreditos } from "@/components/BloqueCreditos";

export default function SuscripcionEmpresaPage() {
  const { usuarioId, suscripcion, diasRestantes } = useAccesoSuscripcion();
  const planes = useAppStore((s) => s.planes);
  const pagos = useAppStore((s) => s.pagos);
  const simularPago = useAppStore((s) => s.simularPago);

  const [modalidad, setModalidad] = useState<ModalidadSuscripcion>("mensual");

  const planActual = suscripcion ? planes.find((p) => p.id === suscripcion.planId) : undefined;
  // El plan trial no se compra: queda fuera del comparador (docs/05 §9.2).
  const planesEmpresa = planes.filter((p) => p.rol === "empresa" && !p.esTrial);
  const historialPagos = suscripcion
    ? pagos.filter((p) => p.suscripcionId === suscripcion.id).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
    : [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Mi suscripción</h1>
        <p className="text-sm text-ink-soft">Gestiona el plan de tu empresa en la plataforma.</p>
      </div>

      <div className="rounded-2xl border border-line p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <CreditCard className="h-3.5 w-3.5" /> Plan actual
            </p>
            <p className="mt-1 font-display text-xl font-bold text-ink">{planActual?.nombre ?? "Sin plan activo"}</p>
          </div>
          {suscripcion && (
            <div className="flex items-center gap-3">
              <Badge className={ESTADO_SUSCRIPCION_ESTILO[suscripcion.estado]}>
                {ESTADO_SUSCRIPCION_LABEL[suscripcion.estado]}
              </Badge>
              <div className="text-right text-sm">
                <p className="text-ink-faint">
                  {suscripcion.estado === "vencida" ? "Venció el" : "Vence el"}
                </p>
                <p className="font-medium text-ink">{formatFecha(suscripcion.fechaVencimiento)}</p>
              </div>
            </div>
          )}
        </div>

        {suscripcion && (
          <p className="mt-3 text-sm text-ink-soft">
            {suscripcion.estado === "vencida"
              ? "Tu suscripción está vencida. Renuévala para volver a postularte, ver sugerencias y solicitar consultores."
              : diasRestantes !== null && diasRestantes >= 0
                ? `Te quedan ${diasRestantes} ${diasRestantes === 1 ? "día" : "días"} de ${
                    suscripcion.modalidad === "trial" ? "periodo de prueba" : "vigencia"
                  }.`
                : null}
          </p>
        )}
      </div>

      <BloqueCreditos />

      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-ink">Planes disponibles</h2>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
            <button
              onClick={() => setModalidad("mensual")}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                modalidad === "mensual" ? "bg-white text-primary-800 shadow-sm" : "text-ink-soft"
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setModalidad("anual")}
              className={cn(
                "rounded-md px-3 py-1 transition-colors",
                modalidad === "anual" ? "bg-white text-primary-800 shadow-sm" : "text-ink-soft"
              )}
            >
              Anual <span className="text-gold-600">(2 meses gratis)</span>
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {planesEmpresa.map((plan) => {
            const precio = modalidad === "anual" ? plan.precioAnual : plan.precioMensual;
            const esActual = planActual?.id === plan.id && suscripcion?.estado !== "vencida";
            return (
              <div
                key={plan.id}
                className={cn(
                  "flex flex-col rounded-2xl border p-5",
                  esActual ? "border-primary-500 ring-1 ring-primary-100" : "border-line"
                )}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-ink">{plan.nombre}</h3>
                  {esActual && <Badge className="bg-primary-50 text-primary-800 ring-primary-100">Tu plan</Badge>}
                </div>
                <p className="mt-2">
                  <span className="font-tabular text-2xl font-bold text-primary-800">{formatCOP(precio)}</span>
                  <span className="text-sm text-ink-faint"> / {modalidad === "anual" ? "año" : "mes"}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-ink-soft">
                  {beneficiosDePlan(plan).map((b) => (
                    <li
                      key={b.texto}
                      className={cn(
                        "flex items-start gap-2",
                        b.destacado && "font-semibold text-teal-700"
                      )}
                    >
                      {b.destacado ? (
                        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      )}
                      {b.texto}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={esActual ? "secondary" : "primary"}
                  className="mt-5 w-full"
                  disabled={esActual}
                  onClick={() => simularPago(usuarioId, plan.id, modalidad)}
                >
                  {esActual ? "Plan actual" : "Elegir este plan"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
          <Receipt className="h-4 w-4" /> Historial de pagos
        </h2>
        {historialPagos.length === 0 ? (
          <p className="mt-2 text-sm text-ink-faint">Aún no hay pagos registrados.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {historialPagos.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-3 text-ink-soft">{formatFecha(p.fecha)}</td>
                    <td className="px-5 py-3 font-tabular font-medium text-ink">{formatCOP(p.monto)}</td>
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
