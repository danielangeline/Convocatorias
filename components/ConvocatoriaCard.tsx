"use client";

import Link from "next/link";
import { Bookmark, Landmark } from "lucide-react";
import type { Categoria, Convocatoria } from "@/lib/types";
import {
  cn,
  diasRestantes,
  ESTADO_CONVOCATORIA_LABEL,
  ESTADO_CONVOCATORIA_ESTILO,
  ORIGEN_CONVOCATORIA_LABEL,
} from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { CompatRing } from "./viz/CompatRing";
import { DeadlineChip } from "./viz/Deadline";
import { formatRangoConvocatoria } from "@/lib/monedas";

/**
 * Tarjeta del catálogo. `href`: a dónde lleva; por defecto, la ficha de la
 * empresa. `compatibilidad` (CU-10) pinta el anillo; `onGuardar` (RF-103)
 * muestra el botón de guardar. Las cerradas se ven atenuadas y sin acciones (RN-02).
 */
export function ConvocatoriaCard({
  convocatoria,
  href,
  compatibilidad,
  guardada,
  onGuardar,
}: {
  convocatoria: Convocatoria;
  categorias?: Categoria[];
  href?: string;
  compatibilidad?: number;
  guardada?: boolean;
  onGuardar?: () => void;
}) {
  const dias = diasRestantes(convocatoria.fechaCierre);
  const yaCerro = dias < 0 || convocatoria.estado === "cerrada";
  const esUrgente = !yaCerro && convocatoria.estado === "publicada" && dias < 15;
  const tributario = convocatoria.tipo === "beneficio_tributario";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-[18px] shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-pri",
        yaCerro && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex flex-wrap gap-1.5">
          <Badge tono={tributario ? "violet" : "pri"}>{tributario ? "Beneficio tributario" : "Fondos"}</Badge>
          <Badge tono="neutro">{ORIGEN_CONVOCATORIA_LABEL[convocatoria.origen ?? "publico"]}</Badge>
          {/* RN-39: solo aparece con «incluir las de otros países». */}
          {convocatoria.elegible === false && <Badge tono="neutro">Tu país no es elegible</Badge>}
          {convocatoria.estado !== "publicada" && (
            <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
              {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
            </Badge>
          )}
        </div>
        {compatibilidad !== undefined && !yaCerro && <CompatRing porcentaje={compatibilidad} />}
      </div>

      <div>
        <h3 className="text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-ink [text-wrap:pretty]">
          {/* El enlace cubre la tarjeta; el botón de guardar queda por encima. */}
          <Link href={href ?? `/convocatorias/${convocatoria.id}`} className="after:absolute after:inset-0 after:rounded-2xl group-hover:text-pri-text">
            {convocatoria.nombre}
          </Link>
        </h3>
        <p className="mt-[5px] flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Landmark className="h-[13px] w-[13px] shrink-0" />
          {convocatoria.entidadConvocante}
        </p>
      </div>

      <p className="line-clamp-2 text-[13px] leading-normal text-ink-2">{convocatoria.descripcion}</p>
      {yaCerro && <p className="text-xs font-semibold text-ink-3">Ya no admite postulación.</p>}

      <div className="mt-auto flex items-end justify-between gap-2.5 border-t border-line-2 pt-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-3">{tributario ? "Beneficio" : "Monto"}</p>
          {convocatoria.montoMin == null && convocatoria.montoMax == null ? (
            <p className="mt-0.5 text-[13px] font-semibold text-ink-3">No informado</p>
          ) : (
            <p className="font-tabular mt-0.5 text-sm font-semibold">
              {formatRangoConvocatoria(convocatoria)}
            </p>
          )}
        </div>
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          {yaCerro ? (
            <span className="text-xs font-semibold text-ink-3">Cerrada</span>
          ) : esUrgente ? (
            <DeadlineChip dias={dias} />
          ) : (
            <span className="text-xs font-semibold text-ink-2">Cierra en {dias} días</span>
          )}
          {onGuardar && !yaCerro && (
            <button
              type="button"
              onClick={onGuardar}
              aria-pressed={guardada}
              aria-label={guardada ? "Quitar de guardadas" : "Guardar convocatoria"}
              title={guardada ? "Quitar de guardadas" : "Guardar"}
              className={cn(
                "grid h-10 w-10 cursor-pointer place-items-center rounded-[10px] hover:bg-surface-2",
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
