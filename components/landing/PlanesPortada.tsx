"use client";

import { useState } from "react";
import { Check, Lock, Sparkles } from "lucide-react";
import type { Plan } from "@/lib/types";
import { beneficiosDePlan, FUNCIONES, funcionesNoIncluidas, nombreCortoPlan } from "@/lib/planes";
import { cn, formatCOP } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";

/**
 * Portada · RF-82, RN-41 (sesión 042). Las tres tarjetas de empresa salen de la
 * base —precio, créditos y funciones—, no de una lista fija: un cambio en el
 * panel se ve aquí sin desplegar. «Más elegido» lo pidió el Product Owner para
 * Esencial; no es una cifra de uso.
 */
export function PlanesPortada({ planes, tarifaDocumento }: { planes: Plan[]; tarifaDocumento: number }) {
  const [modalidad, setModalidad] = useState<"mensual" | "anual">("mensual");
  const conAnual = planes.some((p) => !p.esGratuito && p.precioAnual > 0);

  return (
    <div>
      {conAnual && (
        <div className="mb-8 flex justify-center">
          <Segmented
            etiqueta="Modalidad de pago"
            valor={modalidad}
            onChange={setModalidad}
            opciones={[
              { valor: "mensual", etiqueta: "Mensual" },
              { valor: "anual", etiqueta: "Anual" },
            ]}
          />
        </div>
      )}
      <div className={cn("grid gap-5", planes.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {planes.map((plan) => {
          const destacado = /esencial/i.test(plan.nombre);
          const precio = modalidad === "anual" ? plan.precioAnual : plan.precioMensual;
          const ahorro = plan.precioMensual * 12 - plan.precioAnual;
          const corto = nombreCortoPlan(plan.nombre);
          return (
            <article
              key={plan.id}
              aria-labelledby={`plan-portada-${plan.id}`}
              className={cn(
                "relative flex min-w-0 flex-col rounded-md border bg-surface p-6",
                destacado ? "border-pri shadow-card ring-1 ring-pri" : "border-line"
              )}
            >
              {destacado && (
                <span className="absolute -top-3 left-6 rounded-full bg-amber px-3 py-0.5 text-xs font-semibold text-[#0a1a22]">
                  Más elegido
                </span>
              )}
              <h3 id={`plan-portada-${plan.id}`} className="font-display text-xl font-semibold text-ink">
                {corto}
              </h3>
              <p className="mt-3">
                {plan.esGratuito ? (
                  <>
                    <span className="font-tabular text-3xl font-medium text-ink">$0</span>
                    <span className="text-sm text-ink-3"> · sin vencimiento</span>
                  </>
                ) : (
                  <>
                    <span className="font-tabular text-3xl font-medium text-ink">{formatCOP(precio)}</span>
                    <span className="text-sm text-ink-3"> / {modalidad === "anual" ? "año" : "mes"}</span>
                  </>
                )}
              </p>
              <p className="mt-1 min-h-5 text-xs font-semibold text-amber-ink">
                {!plan.esGratuito && modalidad === "anual" && ahorro > 0 ? `Ahorra ${formatCOP(ahorro)} frente a pagar mes a mes` : ""}
              </p>
              <ul className="mt-4 flex-1 space-y-2.5 text-sm text-ink-2">
                {beneficiosDePlan(plan, tarifaDocumento).map((b) => (
                  <li key={b.texto} className={cn("flex items-start gap-2", b.destacado && "font-semibold text-pri-text")}>
                    {b.destacado ? (
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    ) : (
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-pri-text" aria-hidden />
                    )}
                    <span className="min-w-0">{b.texto}</span>
                  </li>
                ))}
                {funcionesNoIncluidas(plan).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink-3">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <span className="sr-only">No incluye: </span>
                      <span className="line-through">{FUNCIONES[f].beneficio}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <LinkButton
                href="/registro?puerta=empresa"
                variant={destacado ? "primary" : "outline"}
                size="lg"
                className="mt-6 w-full"
              >
                {plan.esGratuito ? "Empiece gratis" : `Empiece gratis y pase a ${corto}`}
              </LinkButton>
            </article>
          );
        })}
      </div>
    </div>
  );
}
