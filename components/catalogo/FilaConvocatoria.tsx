"use client";

import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { Convocatoria } from "@/lib/types";
import { cn, diasRestantes, formatFecha, ORIGEN_CONVOCATORIA_LABEL } from "@/lib/utils";
import { formatRangoConvocatoria } from "@/lib/monedas";
import { Badge } from "@/components/ui/Badge";
import { DeadlineChip } from "@/components/viz/Deadline";

/**
 * Fila de resultado del catálogo (rediseño FundRadar): entidad · tipo y NUEVO
 * en ámbar; nombre en serif; bloques Monto, Cierre y «Te aplica»; guardar y
 * «Ver detalle». Usa `flex-wrap` y se apila sola en móvil. Las cerradas se ven
 * atenuadas y sin acciones (RN-02).
 */
export function FilaConvocatoria({
  convocatoria: c,
  href,
  compatibilidad,
  nueva,
  guardada,
  onGuardar,
}: {
  convocatoria: Convocatoria;
  href: string;
  compatibilidad?: number;
  nueva?: boolean;
  guardada?: boolean;
  onGuardar?: () => void;
}) {
  const dias = diasRestantes(c.fechaCierre);
  const yaCerro = dias < 0 || c.estado === "cerrada";
  const tributario = c.tipo === "beneficio_tributario";
  const sinMonto = c.montoMin == null && c.montoMax == null;

  return (
    <article
      className={cn(
        "flex flex-wrap items-center gap-x-6 gap-y-4 rounded-md border border-line bg-surface p-5 transition-colors hover:border-pri",
        yaCerro && "opacity-70"
      )}
    >
      <div className="min-w-0 flex-[1_1_300px]">
        <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[.06em] text-ink-3">
          <span className="truncate">
            {c.entidadConvocante} · {tributario ? "Beneficio tributario" : ORIGEN_CONVOCATORIA_LABEL[c.origen ?? "publico"]}
          </span>
          {nueva && !yaCerro && <span className="rounded-[3px] bg-amber px-1.5 py-0.5 text-[11px] font-bold tracking-normal text-[#0a1a22]">NUEVO</span>}
          {/* RN-39: solo aparece con «incluir las de otros países». */}
          {c.elegible === false && <Badge tono="neutro">Tu país no es elegible</Badge>}
        </p>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-[1.3] text-ink [text-wrap:pretty]">
          <Link href={href} className="hover:text-pri-text hover:underline">
            {c.nombre}
          </Link>
        </h3>
        {yaCerro && <p className="mt-1 text-xs font-semibold text-ink-3">Ya no admite postulación.</p>}
      </div>

      <div className="flex flex-[0_1_auto] flex-wrap items-center gap-x-7 gap-y-3">
        <Dato etiqueta={tributario ? "Beneficio" : "Monto"}>
          {sinMonto ? (
            <span className="text-[13px] font-semibold text-ink-3">No informado</span>
          ) : (
            <span className="font-tabular text-sm font-medium">{formatRangoConvocatoria(c)}</span>
          )}
        </Dato>
        <Dato etiqueta="Cierre">
          {yaCerro ? (
            <span className="text-[13px] font-semibold text-ink-3">Cerrada · {formatFecha(c.fechaCierre)}</span>
          ) : (
            <DeadlineChip dias={dias} />
          )}
        </Dato>
        {compatibilidad !== undefined && !yaCerro && (
          <Dato etiqueta="Te aplica">
            <span className="font-tabular text-sm font-medium text-pri-text">{compatibilidad}%</span>
          </Dato>
        )}
      </div>

      <div className="flex items-center gap-2">
        {onGuardar && !yaCerro && (
          <button
            type="button"
            onClick={onGuardar}
            aria-pressed={guardada}
            aria-label={guardada ? "Quitar de guardadas" : "Guardar convocatoria"}
            title={guardada ? "Quitar de guardadas" : "Guardar"}
            className={cn(
              "grid h-11 w-11 cursor-pointer place-items-center rounded-[4px] border border-line-strong bg-surface hover:bg-surface-2",
              guardada ? "text-pri-text" : "text-ink-3"
            )}
          >
            <Bookmark className={cn("h-4 w-4", guardada && "fill-current")} />
          </button>
        )}
        <Link
          href={href}
          className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[4px] border border-pri bg-surface px-4 text-sm font-semibold text-pri-text hover:bg-pri-soft"
        >
          Ver detalle
        </Link>
      </div>
    </article>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">{etiqueta}</span>
      {children}
    </div>
  );
}
