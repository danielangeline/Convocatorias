"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { Categoria, Convocatoria } from "@/lib/types";
import { cn, diasRestantes, ORIGEN_CONVOCATORIA_LABEL } from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { CompatRing } from "./viz/CompatRing";
import { DeadlineChip } from "./viz/Deadline";
import { formatRangoConvocatoria } from "@/lib/monedas";

/**
 * Tarjeta de convocatoria (pestaña «Sugeridas para ti», guardadas y fichas de
 * consultor). `href`: a dónde lleva; por defecto, la ficha de la empresa.
 * `compatibilidad` (CU-10) pinta el anillo de 48 px y `proyectoNombre` dice con
 * qué proyecto se cruzó; `onGuardar` (RF-103) muestra el botón de guardar. Las
 * cerradas se ven atenuadas y sin acciones (RN-02).
 */
export function ConvocatoriaCard({
  convocatoria,
  href,
  compatibilidad,
  proyectoNombre,
  guardada,
  onGuardar,
}: {
  convocatoria: Convocatoria;
  categorias?: Categoria[];
  href?: string;
  compatibilidad?: number;
  proyectoNombre?: string;
  guardada?: boolean;
  onGuardar?: () => void;
}) {
  const dias = diasRestantes(convocatoria.fechaCierre);
  const yaCerro = dias < 0 || convocatoria.estado === "cerrada";
  const tributario = convocatoria.tipo === "beneficio_tributario";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3.5 rounded-md border border-line bg-surface p-5 transition-colors hover:border-pri",
        yaCerro && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tono="ok">{tributario ? "Beneficio tributario" : "Fondos"}</Badge>
          <Badge tono="neutro">{ORIGEN_CONVOCATORIA_LABEL[convocatoria.origen ?? "publico"]}</Badge>
          {/* RN-39: solo aparece con «incluir las de otros países». */}
          {convocatoria.elegible === false && <Badge tono="neutro">Tu país no es elegible</Badge>}
        </div>
        {compatibilidad !== undefined && !yaCerro && <CompatRing porcentaje={compatibilidad} tamano={48} />}
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold leading-[1.3] text-ink [text-wrap:pretty]">
          {/* El enlace cubre la tarjeta; el botón de guardar queda por encima. */}
          <Link href={href ?? `/convocatorias/${convocatoria.id}`} className="after:absolute after:inset-0 after:rounded-md group-hover:text-pri-text">
            {convocatoria.nombre}
          </Link>
        </h3>
        <p className="mt-1 text-[12.5px] text-ink-3">{convocatoria.entidadConvocante}</p>
        {proyectoNombre && (
          <p className="mt-1.5 text-[13px] text-ink-2">
            Para tu proyecto <strong className="font-semibold text-ink">{proyectoNombre}</strong>
          </p>
        )}
      </div>

      {!proyectoNombre && <p className="line-clamp-2 text-[13px] leading-normal text-ink-2">{convocatoria.descripcion}</p>}
      {yaCerro && <p className="text-xs font-semibold text-ink-3">Ya no admite postulación.</p>}

      <div className="mt-auto flex items-end justify-between gap-2.5 border-t border-line-2 pt-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">{tributario ? "Beneficio" : "Monto"}</p>
          {convocatoria.montoMin == null && convocatoria.montoMax == null ? (
            <p className="mt-0.5 text-[13px] font-semibold text-ink-3">No informado</p>
          ) : (
            <p className="font-tabular mt-0.5 text-sm font-medium">{formatRangoConvocatoria(convocatoria)}</p>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {yaCerro ? <span className="text-xs font-semibold text-ink-3">Cerrada</span> : <DeadlineChip dias={dias} />}
          {onGuardar && !yaCerro && (
            <button
              type="button"
              onClick={onGuardar}
              aria-pressed={guardada}
              aria-label={guardada ? "Quitar de guardadas" : "Guardar convocatoria"}
              title={guardada ? "Quitar de guardadas" : "Guardar"}
              className={cn(
                "grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] hover:bg-surface-2",
                guardada ? "text-pri-text" : "text-ink-3"
              )}
            >
              <Bookmark className={cn("h-4 w-4", guardada && "fill-current")} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
