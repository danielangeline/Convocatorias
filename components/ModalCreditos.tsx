"use client";

import { Sparkles, X, Info } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { textoCreditos, useCreditos } from "@/lib/hooks";
import { CONTRATAR_EN_PILOTO } from "@/lib/planes";
import { formatFecha } from "@/lib/utils";
import { Button } from "./ui/Button";

/**
 * CU-35 · Sin créditos de IA. Explica cómo conseguir más (paquete adicional,
 * RF-51, o un plan con más cupo) sin simular la compra: en el piloto los
 * otorga el administrador (CU-28 paso 3, CU-31 paso 3). El cupo lo decide el
 * servidor (RN-17).
 */
export function ModalCreditos() {
  const abierto = useAppStore((s) => s.modalCreditosAbierto);
  const motivo = useAppStore((s) => s.motivoModalCreditos);
  const cerrar = useAppStore((s) => s.cerrarModalCreditos);
  const { disponibles, incluidos, extra, fechaReinicio } = useCreditos();

  if (!abierto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="titulo-sin-creditos" className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet/10 text-violet-ink">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 id="titulo-sin-creditos" className="font-display text-lg font-bold text-ink">Sin créditos de IA</h2>
              <p className="text-sm text-ink-2">No te quedan créditos para {motivo || "generar el documento"}.</p>
            </div>
          </div>
          <button onClick={cerrar} className="text-ink-3 hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl bg-surface-2 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-ink-2">Créditos disponibles</span>
            <span className="font-tabular font-bold text-ink">{disponibles.toLocaleString("es-CO")}</span>
          </div>
          <p className="mt-2 text-xs text-ink-3">
            Tu plan incluye {textoCreditos(incluidos)} al mes
            {extra > 0 && ` y tienes ${extra.toLocaleString("es-CO")} de paquetes, que no expiran`}.
            {fechaReinicio && ` El cupo del plan se renueva el ${formatFecha(fechaReinicio)}.`}
          </p>
        </div>

        <p className="mt-4 text-sm text-ink-2">
          Puedes pedir un <strong>paquete de créditos adicionales</strong>, que no expiran, o pasar a un plan con más créditos al mes.
        </p>
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-2">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {CONTRATAR_EN_PILOTO}
        </p>

        <Button variant="ghost" className="mt-4 w-full" onClick={cerrar}>
          Entendido
        </Button>
      </div>
    </div>
  );
}
