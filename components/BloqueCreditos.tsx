"use client";

import { Sparkles } from "lucide-react";
import { useCreditos } from "@/lib/hooks";
import { formatFecha } from "@/lib/utils";
import { ProgressBar } from "./ui/ProgressBar";

/**
 * CU-30 paso 2 · RF-41 · Créditos de IA del periodo: incluidos, usados,
 * disponibles y fecha de reinicio. Solo en planes con cupo (el consultor no lo
 * tiene, RN-28). Los paquetes adicionales los otorga el administrador (RF-51).
 */
export function BloqueCreditos() {
  const { suscripcion, vigente, disponibles, usados, incluidos, extra, fechaReinicio } = useCreditos();

  if (!suscripcion || incluidos + extra === 0) return null;

  const cupoTotal = incluidos + extra;
  const porcentajeUsado = cupoTotal > 0 ? Math.round((Math.min(usados, incluidos) / cupoTotal) * 100) : 0;

  return (
    <div className="mt-8 rounded-2xl border border-teal-100 bg-teal-50/20 p-6">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Sparkles className="h-4 w-4 text-teal-600" /> Créditos de IA
      </h2>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-soft">Disponibles este periodo</span>
        <span className="font-tabular text-lg font-bold text-ink">{disponibles}</span>
      </div>
      <ProgressBar porcentaje={porcentajeUsado} tono="teal" className="mt-2" />
      {!vigente && (
        <p className="mt-2 text-xs text-danger">Sin una suscripción vigente no puedes generar ni ajustar documentos con IA.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{usados}</p>
          <p className="text-xs text-ink-faint">Usados del plan</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{incluidos}</p>
          <p className="text-xs text-ink-faint">Incluidos al mes</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{extra}</p>
          <p className="text-xs text-ink-faint">De paquetes (no expiran)</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{fechaReinicio ? formatFecha(fechaReinicio) : "—"}</p>
          <p className="text-xs text-ink-faint">Se renueva el</p>
        </div>
      </div>
    </div>
  );
}
