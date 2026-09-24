"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Aviso } from "@/components/identidad/Campo";

/**
 * Motivo obligatorio para rechazar un perfil (RN-13) o suspender a un
 * consultor (CU-27). El servidor vuelve a exigirlo; aquí solo se evita el
 * viaje en vano.
 */
export function ModalMotivo({
  titulo,
  explicacion,
  etiquetaConfirmar,
  error,
  ocupado,
  onConfirmar,
  onCerrar,
}: {
  titulo: string;
  explicacion: React.ReactNode;
  etiquetaConfirmar: string;
  error: string | null;
  ocupado: boolean;
  onConfirmar: (motivo: string) => void;
  onCerrar: () => void;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-950/40 p-4">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onSubmit={(evento) => {
          evento.preventDefault();
          if (motivo.trim()) onConfirmar(motivo.trim());
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">{titulo}</h3>
          <button type="button" onClick={onCerrar} className="text-ink-faint hover:text-ink" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-4 text-sm text-ink-soft">{explicacion}</div>
        <label htmlFor="motivo" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Motivo
        </label>
        <textarea
          id="motivo"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={4}
          maxLength={1000}
          autoFocus
          placeholder="El consultor verá este texto."
          className="w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
        />
        {error && (
          <div className="mt-3">
            <Aviso tipo="error">{error}</Aviso>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" disabled={!motivo.trim() || ocupado}>
            {ocupado ? "Guardando…" : etiquetaConfirmar}
          </Button>
        </div>
      </form>
    </div>
  );
}
