import { Plus } from "lucide-react";
import { calcularCompletitud, toneCompletitud, ESTILO_COMPLETITUD } from "@/lib/proyectos";
import type { CampoContenido } from "@/lib/proyectos";
import type { Proyecto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";

const TONO_BARRA: Record<"bajo" | "medio" | "alto", "rose" | "amber" | "pri"> = {
  bajo: "rose",
  medio: "amber",
  alto: "pri",
};

export function CompletitudBadge({ proyecto, className }: { proyecto: Proyecto; className?: string }) {
  const { porcentaje } = calcularCompletitud(proyecto);
  const tono = toneCompletitud(porcentaje);
  return (
    <Badge className={cn(ESTILO_COMPLETITUD[tono], className)}>
      {porcentaje}% completo
    </Badge>
  );
}

/**
 * RF-81: el indicador es accionable. Cuando recibe `onCompletar`, cada campo
 * faltante se convierte en un botón que abre la edición ya situada en ese
 * campo, en vez de limitarse a enumerar la carencia.
 */
export function CompletitudDetalle({
  proyecto,
  onCompletar,
}: {
  proyecto: Proyecto;
  onCompletar?: (clave: CampoContenido["clave"]) => void;
}) {
  const { porcentaje, completos, total, faltantes } = calcularCompletitud(proyecto);
  const tono = toneCompletitud(porcentaje);

  return (
    <div className="rounded-xl border border-line-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Completitud del contenido</p>
        <span className="font-tabular text-sm font-bold text-ink">
          {completos}/{total} · {porcentaje}%
        </span>
      </div>
      <ProgressBar porcentaje={porcentaje} tono={TONO_BARRA[tono]} className="mt-2" />

      {faltantes.length === 0 ? (
        <p className="mt-2 text-xs text-pri-text">Todo el contenido está diligenciado.</p>
      ) : onCompletar ? (
        <div className="mt-3">
          <p className="text-xs text-ink-3">
            {faltantes.length === 1
              ? "Falta un campo. Tócalo para completarlo:"
              : `Faltan ${faltantes.length} campos. Toca el que quieras completar:`}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {faltantes.map((f) => (
              <button
                key={f.clave}
                type="button"
                onClick={() => onCompletar(f.clave)}
                className="inline-flex items-center gap-1 rounded-md bg-amber/10 px-2.5 py-1 text-xs font-medium text-amber-ink ring-1 ring-inset ring-amber/30 transition-colors hover:bg-amber/20"
              >
                <Plus className="h-3 w-3" /> {f.etiqueta}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-xs text-ink-3">
          Falta: {faltantes.map((f) => f.etiqueta).join(", ")}.
        </p>
      )}

      <p className="mt-2 text-xs text-ink-3">
        A mayor completitud, mejor será el documento que genere la IA.
      </p>
    </div>
  );
}
