"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, ExternalLink, Send, Undo2 } from "lucide-react";
import type { PropuestaEncargo } from "@/lib/types";
import { pedir } from "@/lib/pedir";
import { ESTADO_PROPUESTA_LABEL, ESTADO_PROPUESTA_ESTILO } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const NOTA_MAXIMA = 1000;

/**
 * RF-92 · Al pie de la ficha que el consultor abre desde su encargo: proponer
 * esta convocatoria a la empresa con una nota obligatoria, o ver y retirar la
 * propuesta que ya hizo. Sin postular ni generar (RF-91). La base vuelve a
 * comprobar todo: encargo en curso, sin elegida, convocatoria vigente y una
 * sola propuesta por convocatoria.
 */
export function ProponerConvocatoria({
  encargoId,
  convocatoriaId,
  empresaNombre,
  propuesta,
  admitePropuestas,
  urlPostulacion,
}: {
  encargoId: string;
  convocatoriaId: string;
  empresaNombre: string;
  propuesta: PropuestaEncargo | null;
  admitePropuestas: boolean;
  urlPostulacion?: string;
}) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const proponer = async () => {
    setError(null);
    setEnviando(true);
    const r = await pedir(`/api/consultor/encargos/${encargoId}/propuestas`, { convocatoriaId, nota });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setNota("");
    router.refresh();
  };

  const retirar = async () => {
    if (!propuesta || !window.confirm("¿Retirar esta propuesta? La empresa dejará de verla como opción.")) return;
    setError(null);
    setEnviando(true);
    const r = await pedir(`/api/consultor/propuestas/${propuesta.id}/retirar`);
    setEnviando(false);
    if (!r.ok) setError(r.error);
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {propuesta ? (
        <div className="rounded-xl border border-line-soft bg-slate-50/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge className={ESTADO_PROPUESTA_ESTILO[propuesta.estado]}>
              {propuesta.estado === "elegida" && <CheckCircle2 className="h-3 w-3" />}
              {ESTADO_PROPUESTA_LABEL[propuesta.estado]}
            </Badge>
            {propuesta.estado === "propuesta" && (
              <Button variant="ghost" size="sm" className="text-ink-soft" disabled={enviando} onClick={retirar}>
                <Undo2 className="h-3.5 w-3.5" /> Retirar propuesta
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs font-semibold text-ink-faint">Tu nota para {empresaNombre}</p>
          <p className="whitespace-pre-line text-sm text-ink-soft">{propuesta.nota}</p>
          {propuesta.estado === "retirada" && (
            <p className="mt-2 text-xs text-ink-faint">Una convocatoria se propone una sola vez por encargo.</p>
          )}
        </div>
      ) : admitePropuestas ? (
        <div>
          <label htmlFor="nota-propuesta" className="block text-sm font-semibold text-ink">
            Proponer esta convocatoria a {empresaNombre}
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">
            Explica por qué le sirve al proyecto. La empresa verá tu nota y el porcentaje de compatibilidad, y puede elegirla.
          </p>
          <textarea
            id="nota-propuesta"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={4}
            maxLength={NOTA_MAXIMA}
            placeholder="Por ejemplo: financia proyectos del sector y el monto que busca la empresa está dentro del rango."
            className="mt-2 w-full resize-none rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-primary-500"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-ink-faint">
              {nota.trim().length.toLocaleString("es-CO")}/{NOTA_MAXIMA.toLocaleString("es-CO")}
            </span>
            <Button variant="primary" onClick={proponer} disabled={enviando || !nota.trim()}>
              <Send className="h-4 w-4" /> {enviando ? "Enviando…" : "Proponer a la empresa"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-ink-soft">
          La empresa ya eligió una convocatoria para este encargo: ya no se admiten más propuestas.
        </p>
      )}

      {urlPostulacion && (
        <a
          href={urlPostulacion}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:underline"
        >
          <ExternalLink className="h-4 w-4" /> Ver en el portal de la entidad
        </a>
      )}
    </div>
  );
}
