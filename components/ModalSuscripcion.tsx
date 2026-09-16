"use client";

import { useState } from "react";
import { Lock, X, Check } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useAccesoSuscripcion } from "@/lib/hooks";
import type { ModalidadSuscripcion } from "@/lib/types";
import { cn, formatCOP } from "@/lib/utils";
import { Button } from "./ui/Button";

export function ModalSuscripcion() {
  const abierto = useAppStore((s) => s.modalSuscripcionAbierto);
  const motivo = useAppStore((s) => s.motivoModalSuscripcion);
  const cerrar = useAppStore((s) => s.cerrarModalSuscripcion);
  const planes = useAppStore((s) => s.planes);
  const simularPago = useAppStore((s) => s.simularPago);
  const { usuarioId, rol } = useAccesoSuscripcion();
  const [modalidad, setModalidad] = useState<ModalidadSuscripcion>("mensual");

  if (!abierto) return null;

  const planesRol = planes.filter((p) => p.rol === (rol === "consultor" ? "consultor" : "empresa") && !p.esTrial);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-primary-950/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brick-50 text-brick-600">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Suscríbete para continuar</h2>
              <p className="text-sm text-ink-soft">
                Necesitas una suscripción activa para {motivo || "continuar"}.
              </p>
            </div>
          </div>
          <button onClick={cerrar} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
          <button
            onClick={() => setModalidad("mensual")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 transition-colors",
              modalidad === "mensual" ? "bg-white text-primary-800 shadow-sm" : "text-ink-soft"
            )}
          >
            Mensual
          </button>
          <button
            onClick={() => setModalidad("anual")}
            className={cn(
              "flex-1 rounded-md px-3 py-1.5 transition-colors",
              modalidad === "anual" ? "bg-white text-primary-800 shadow-sm" : "text-ink-soft"
            )}
          >
            Anual <span className="text-gold-600">(2 meses gratis)</span>
          </button>
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
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" /> Acceso completo a la plataforma
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" />{" "}
                    {rol === "consultor" ? "Visibilidad en el directorio" : "Postulaciones y sugerencias ilimitadas"}
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-success" /> Soporte prioritario
                  </li>
                </ul>
                <Button
                  variant="primary"
                  className="mt-5 w-full"
                  onClick={() => simularPago(usuarioId, plan.id, modalidad)}
                >
                  Elegir {plan.nombre}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-center text-xs text-ink-faint">
          Simulación de pago para este prototipo — no se realiza ningún cobro real.
        </p>
      </div>
    </div>
  );
}
