"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import type { TarifasIA as Tarifas } from "@/lib/types";
import { peticionAdmin } from "@/lib/admin/peticion";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";

/**
 * RF-100 · Cuántos créditos cuesta cada uso de la IA (RN-17). El cambio rige
 * desde el siguiente uso, sin desplegar; la base guarda quién y cuándo.
 */
const ACCIONES: { clave: keyof Tarifas; nombre: string; nota: string }[] = [
  { clave: "generacion", nombre: "Generar o regenerar un documento", nota: "" },
  { clave: "estructuracion", nombre: "Crear un proyecto con IA", nota: "" },
  { clave: "ajuste", nombre: "Ajuste con IA de un documento", nota: "Los 3 primeros de cada documento son gratis." },
];

export function TarifasIA({ tarifas }: { tarifas: Tarifas }) {
  const router = useRouter();
  const [valores, setValores] = useState<Record<keyof Tarifas, string>>({
    generacion: String(tarifas.generacion),
    estructuracion: String(tarifas.estructuracion),
    ajuste: String(tarifas.ajuste),
  });
  const [ocupado, setOcupado] = useState<keyof Tarifas | null>(null);
  const [mensaje, setMensaje] = useState<{ tipo: "error" | "exito"; texto: string } | null>(null);

  const guardar = async (clave: keyof Tarifas) => {
    setOcupado(clave);
    setMensaje(null);
    const r = await peticionAdmin(`/api/admin/tarifas/${clave}`, "PATCH", { creditos: Number(valores[clave]) });
    setOcupado(null);
    setMensaje(r.ok ? { tipo: "exito", texto: r.aviso ?? "Tarifa guardada." } : { tipo: "error", texto: r.error });
    if (r.ok) router.refresh();
  };

  return (
    <div className="mt-10 rounded-2xl border border-violet/30 bg-violet/10 p-4 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
        <Sparkles className="h-4 w-4 text-violet-ink" /> Cuánto cuesta cada uso de la IA
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        En créditos. Rige desde el siguiente uso, para todas las empresas. Dictar y editar a mano no cuestan; un uso fallido no cobra.
      </p>
      {mensaje && (
        <div className="mt-3">
          <Aviso tipo={mensaje.tipo}>{mensaje.texto}</Aviso>
        </div>
      )}
      <div className="mt-4 space-y-3">
        {ACCIONES.map((a) => (
          <div key={a.clave} className="flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 text-sm">
              <span className="mb-1 block font-medium text-ink">{a.nombre}</span>
              {a.nota && <span className="mb-1 block text-xs text-ink-3">{a.nota}</span>}
              <input
                inputMode="numeric"
                value={valores[a.clave]}
                onChange={(e) => setValores({ ...valores, [a.clave]: e.target.value })}
                className="w-40 rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-violet bg-surface text-ink"
              />
            </label>
            <Button
              variant="teal"
              size="sm"
              onClick={() => guardar(a.clave)}
              disabled={ocupado !== null || Number(valores[a.clave]) === tarifas[a.clave]}
            >
              {ocupado === a.clave ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
