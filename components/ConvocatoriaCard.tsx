import Link from "next/link";
import { MapPin, Landmark } from "lucide-react";
import type { Categoria, Convocatoria } from "@/lib/types";
import {
  cn,
  diasRestantes,
  formatRangoCOP,
  formatFecha,
  ESTADO_CONVOCATORIA_LABEL,
  ESTADO_CONVOCATORIA_ESTILO,
} from "@/lib/utils";
import { Badge } from "./ui/Badge";
import { Chip } from "./ui/Chip";
import { DeadlineChip } from "./viz/Deadline";
import { textoCobertura } from "@/lib/departamentos";

/** `href`: a dónde lleva la tarjeta; por defecto, la ficha del catálogo de la empresa. */
export function ConvocatoriaCard({
  convocatoria,
  categorias,
  href,
}: {
  convocatoria: Convocatoria;
  categorias: Categoria[];
  href?: string;
}) {
  const dias = diasRestantes(convocatoria.fechaCierre);
  const esUrgente = convocatoria.estado === "publicada" && dias >= 0 && dias < 15;
  const yaCerro = dias < 0 || convocatoria.estado === "cerrada";

  const categoriasVisibles = convocatoria.categorias
    .map((id) => categorias.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Link
      href={href ?? `/convocatorias/${convocatoria.id}`}
      className={cn(
        "group flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-[18px] shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-pri",
        yaCerro && "opacity-70"
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
          {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
        </Badge>
        {esUrgente && <DeadlineChip dias={dias} />}
      </div>

      <div>
        <h3 className="text-[15px] font-extrabold leading-snug tracking-[-0.01em] text-ink [text-wrap:pretty] group-hover:text-pri-text">
          {convocatoria.nombre}
        </h3>
        <p className="mt-[5px] flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Landmark className="h-[13px] w-[13px] shrink-0" />
          {convocatoria.entidadConvocante}
        </p>
      </div>

      <p className="line-clamp-2 text-[13px] leading-normal text-ink-2">{convocatoria.descripcion}</p>
      {/* RN-02: marcada como cerrada y sin acciones. */}
      {yaCerro && <p className="text-xs font-semibold text-ink-3">Ya no admite postulación.</p>}

      {categoriasVisibles.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categoriasVisibles.map((cat) => (
            <Chip key={cat!.id} tono={cat!.tipo}>
              {cat!.nombre}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between gap-2.5 border-t border-line-2 pt-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-ink-3">Monto</p>
          <p className="font-tabular mt-0.5 text-sm font-semibold">
            {formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-ink-3">
            <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{textoCobertura(convocatoria)}</span>
          </p>
        </div>
        <div className="shrink-0 text-right text-xs text-ink-3">
          <p>{yaCerro ? "Cerró" : "Cierra"}</p>
          <p className="font-semibold text-ink-2">{formatFecha(convocatoria.fechaCierre)}</p>
        </div>
      </div>
    </Link>
  );
}
