"use client";

import { Sparkles } from "lucide-react";
import { useCreditos, useTarifas } from "@/lib/hooks";
import { formatFecha } from "@/lib/utils";
import { ProgressBar } from "./ui/ProgressBar";

/**
 * CU-30 paso 2 · RF-41 · Créditos de IA del periodo: incluidos, usados,
 * disponibles y fecha de reinicio. Solo en planes con cupo (el consultor no lo
 * tiene, RN-28). Los paquetes adicionales los otorga el administrador (RF-51).
 */
export function BloqueCreditos() {
  const { suscripcion, vigente, disponibles, usados, incluidos, extra, fechaReinicio } = useCreditos();
  const tarifas = useTarifas();
  const n = (v: number) => v.toLocaleString("es-CO");

  if (!suscripcion || incluidos + extra === 0) return null;

  const cupoTotal = incluidos + extra;
  const porcentajeUsado = cupoTotal > 0 ? Math.round((Math.min(usados, incluidos) / cupoTotal) * 100) : 0;

  return (
    <div className="mt-8 rounded-2xl border border-violet/30 bg-violet/10 p-6">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Sparkles className="h-4 w-4 text-violet-ink" /> Créditos de IA
      </h2>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-ink-2">Disponibles este periodo</span>
        <span className="font-tabular text-lg font-bold text-ink">{n(disponibles)}</span>
      </div>
      <ProgressBar porcentaje={porcentajeUsado} tono="violet" className="mt-2" />
      {!vigente && (
        <p className="mt-2 text-xs text-rose-ink">Sin una suscripción vigente no puedes generar ni ajustar documentos con IA.</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{n(usados)}</p>
          <p className="text-xs text-ink-3">Usados del plan</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{n(incluidos)}</p>
          <p className="text-xs text-ink-3">Incluidos al mes</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{n(extra)}</p>
          <p className="text-xs text-ink-3">De paquetes (no expiran)</p>
        </div>
        <div>
          <p className="font-tabular text-sm font-semibold text-ink">{fechaReinicio ? formatFecha(fechaReinicio) : "—"}</p>
          <p className="text-xs text-ink-3">Se renueva el</p>
        </div>
      </div>

      {/* RN-17: cuánto cuesta cada uso (tarifas vigentes, RF-100). */}
      <div className="mt-5 border-t border-violet/30 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Cuánto cuesta cada uso</p>
        <ul className="mt-2 grid gap-1.5 text-sm text-ink-2 sm:grid-cols-2">
          <li className="flex justify-between gap-3"><span>Generar o regenerar un documento</span><span className="font-tabular font-semibold text-ink">{n(tarifas.generacion)}</span></li>
          <li className="flex justify-between gap-3"><span>Crear un proyecto con IA</span><span className="font-tabular font-semibold text-ink">{n(tarifas.estructuracion)}</span></li>
          <li className="flex justify-between gap-3"><span>Ajuste con IA (desde el cuarto de cada documento)</span><span className="font-tabular font-semibold text-ink">{n(tarifas.ajuste)}</span></li>
          <li className="flex justify-between gap-3"><span>Dictar, editar a mano y los 3 primeros ajustes</span><span className="font-semibold text-violet-ink">Gratis</span></li>
        </ul>
        <p className="mt-2 text-xs text-ink-3">Si un uso falla, no se descuenta nada.</p>
      </div>
    </div>
  );
}
