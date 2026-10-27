"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PencilLine, Sparkles, X } from "lucide-react";
import type { PropuestaProyecto } from "@/lib/types";
import { textoCreditos, useCreditos, useTarifas } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { BotonDictado } from "./BotonDictado";

/**
 * CU-43 · Primer paso de "Nuevo proyecto": la empresa cuenta su proyecto,
 * escribiendo o dictando (RF-97), y la IA arma el formulario (RF-96). Es
 * opcional: "Llenar el formulario a mano" abre CU-09 vacío, sin costo.
 */

const MIN = 80;
const MAX = 8000;

export function AsistenteProyecto({
  onPropuesta,
  onManual,
  onClose,
}: {
  onPropuesta: (p: PropuestaProyecto) => void;
  onManual: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const { disponibles, vigente } = useCreditos();
  // RN-17: crear con IA cuesta la tarifa vigente (50 al iniciar la sesión 030).
  const costo = useTarifas().estructuracion;
  const [explicacion, setExplicacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !creando) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, creando]);

  const largo = explicacion.trim().length;
  const sinCredito = !vigente || disponibles < costo;

  const agregarDictado = (texto: string) => {
    setExplicacion((actual) => {
      const junto = actual.trim() ? `${actual.trimEnd()} ${texto}` : texto;
      return junto.slice(0, MAX);
    });
  };

  const crear = async () => {
    setError(null);
    if (largo < MIN) {
      setError("Cuéntanos un poco más: qué hace el proyecto, para quién, dónde y cuánto necesitas.");
      return;
    }
    setCreando(true);
    try {
      const r = await fetch("/api/proyectos/estructurar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ explicacion }),
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(json.error ?? "No pudimos armar el proyecto con IA. No se descontó ningún crédito.");
        setCreando(false);
        return;
      }
      // El crédito ya se descontó: el indicador de créditos se actualiza.
      router.refresh();
      onPropuesta(json.datos as PropuestaProyecto);
    } catch {
      setError("No pudimos conectarnos. Revisa tu conexión e intenta de nuevo.");
      setCreando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo proyecto"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface p-6 shadow-xl"
      >
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-ink">Nuevo proyecto</h3>
          <button onClick={onClose} disabled={creando} className="text-ink-3 hover:text-ink disabled:opacity-40" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-violet-ink">
          <Sparkles className="h-4 w-4" /> Cuéntanos tu proyecto y la IA llena el formulario
        </p>

        <label htmlFor="explicacion-proyecto" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">
          ¿De qué trata tu proyecto?
        </label>
        <div className="rounded-xl border border-line focus-within:border-violet">
          <textarea
            id="explicacion-proyecto"
            value={explicacion}
            onChange={(e) => setExplicacion(e.target.value.slice(0, MAX))}
            disabled={creando}
            rows={8}
            placeholder="Escribe o dicta con el micrófono: qué problema resuelve, a quién beneficia, dónde se ejecuta, qué actividades harás, cuánto dinero buscas, en cuánto tiempo y qué experiencia tiene tu empresa."
            className="block w-full resize-none rounded-t-xl px-3 py-2.5 text-sm outline-none disabled:bg-surface-2"
          />
          <div className="flex items-center justify-between gap-3 border-t border-line-2 px-2 py-1.5">
            <BotonDictado onTexto={agregarDictado} onError={setError} deshabilitado={creando || sinCredito} />
            <span className={`text-xs ${largo > 0 && largo < MIN ? "text-amber-ink" : "text-ink-3"}`}>
              {largo < MIN ? `${largo}/${MIN} caracteres mínimos` : `${largo.toLocaleString("es-CO")} caracteres`}
            </span>
          </div>
        </div>

        <p className="mt-2 text-xs text-ink-3">
          La IA usa solo lo que tú cuentes: lo que no digas queda vacío para que lo completes. Ni el audio ni el texto se guardan.
        </p>

        {sinCredito && (
          <p className="mt-3 rounded-lg bg-amber/10 px-3 py-2.5 text-sm text-amber-ink">
            {vigente
              ? `Crear con IA cuesta ${textoCreditos(costo)} y te quedan ${textoCreditos(disponibles)}. Puedes llenar el formulario a mano sin costo.`
              : "Necesitas una suscripción vigente para crear el proyecto con IA. Puedes llenar el formulario a mano."}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose/10 px-3 py-2.5 text-sm text-rose-ink">
            {error}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onManual} disabled={creando}>
            <PencilLine className="h-4 w-4" /> Llenar el formulario a mano
          </Button>
          <Button variant="ai" onClick={crear} disabled={creando || sinCredito || largo === 0}>
            {creando ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Armando tu proyecto…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Crear con IA · {textoCreditos(costo)}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
