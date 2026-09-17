"use client";

import { Building2, HardHat } from "lucide-react";
import type { Puerta } from "@/lib/rutas";
import { cn } from "@/lib/utils";

export const TITULO_PUERTA: Record<Puerta, string> = {
  empresa: "Soy empresa o entidad",
  consultor: "Soy consultor",
};

const ICONO: Record<Puerta, typeof Building2> = { empresa: Building2, consultor: HardHat };

/**
 * Las dos puertas de la entrada (RF-84, CU-14). En el registro fijan el rol; en
 * el inicio de sesión solo orientan. Viaja en el formulario como `puerta`.
 */
export function SelectorPuerta({
  puerta,
  onCambio,
  detalle,
}: {
  puerta: Puerta;
  onCambio: (puerta: Puerta) => void;
  detalle?: Record<Puerta, string>;
}) {
  return (
    <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <legend className="sr-only">¿Cómo usas la plataforma?</legend>
      {(["empresa", "consultor"] as const).map((valor) => {
        const Icono = ICONO[valor];
        return (
          <label
            key={valor}
            className={cn(
              "cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-100",
              puerta === valor
                ? valor === "empresa"
                  ? "border-primary-500 bg-primary-50"
                  : "border-brick-500 bg-brick-50"
                : "border-line hover:bg-slate-50"
            )}
          >
            <input
              type="radio"
              name="puerta"
              value={valor}
              checked={puerta === valor}
              onChange={() => onCambio(valor)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Icono className="h-4 w-4 shrink-0" /> {TITULO_PUERTA[valor]}
            </span>
            {detalle && <span className="mt-1 block text-xs text-ink-soft">{detalle[valor]}</span>}
          </label>
        );
      })}
    </fieldset>
  );
}
