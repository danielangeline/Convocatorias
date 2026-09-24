import Link from "next/link";
import { MapPin, Clock, Landmark } from "lucide-react";
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
import { textoCobertura } from "@/lib/departamentos";

export function ConvocatoriaCard({ convocatoria, categorias }: { convocatoria: Convocatoria; categorias: Categoria[] }) {
  const dias = diasRestantes(convocatoria.fechaCierre);
  const esUrgente = convocatoria.estado === "publicada" && dias >= 0 && dias < 15;
  const yaCerro = dias < 0 || convocatoria.estado === "cerrada";

  const categoriasVisibles = convocatoria.categorias
    .map((id) => categorias.find((c) => c.id === id))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <Link
      href={`/convocatorias/${convocatoria.id}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-[0_12px_32px_-16px_rgba(31,56,100,0.35)]",
        esUrgente ? "border-l-4 border-l-gold-500" : yaCerro ? "border-l-4 border-l-slate-300 bg-slate-50/60" : "border-l-4 border-l-primary-800"
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <Badge className={ESTADO_CONVOCATORIA_ESTILO[convocatoria.estado]}>
            {ESTADO_CONVOCATORIA_LABEL[convocatoria.estado]}
          </Badge>
          {esUrgente && (
            <Badge className="bg-gold-50 text-gold-700 ring-gold-200">
              <Clock className="h-3 w-3" /> Cierra en {dias} {dias === 1 ? "día" : "días"}
            </Badge>
          )}
        </div>

        <div>
          <h3 className="font-display text-base font-semibold leading-snug text-ink group-hover:text-primary-800">
            {convocatoria.nombre}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
            <Landmark className="h-3.5 w-3.5 shrink-0" />
            {convocatoria.entidadConvocante}
          </p>
        </div>

        <p className="line-clamp-2 text-sm text-ink-soft">{convocatoria.descripcion}</p>
        {/* RN-02: marcada como cerrada y sin acciones. */}
        {yaCerro && <p className="text-xs font-medium text-slate-500">Ya no admite postulación.</p>}

        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {categoriasVisibles.map((cat) => (
            <Chip key={cat!.id} tono={cat!.tipo}>
              {cat!.nombre}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-line-soft bg-primary-50/40 px-5 py-3">
        <div>
          <p className="font-tabular text-sm font-semibold text-primary-800">
            {formatRangoCOP(convocatoria.montoMin, convocatoria.montoMax)}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-faint">
            <MapPin className="h-3 w-3" /> {textoCobertura(convocatoria)}
          </p>
        </div>
        <div className="text-right text-xs text-ink-faint">
          <p>{yaCerro ? "Cerró" : "Cierra"}</p>
          <p className="font-medium text-ink-soft">{formatFecha(convocatoria.fechaCierre)}</p>
        </div>
      </div>
    </Link>
  );
}
