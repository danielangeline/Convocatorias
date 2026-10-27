import { ProgressBar } from "@/components/ui/ProgressBar";

/** Nombre y etapa, barra de 6 px (pri si está completa, sky si no) y el conteo del checklist. */
export function ProgressRow({
  nombre,
  etapa,
  hechos,
  total,
  dias,
}: {
  nombre: string;
  etapa: string;
  hechos: number;
  total: number;
  dias?: number;
}) {
  const pct = total > 0 ? (hechos / total) * 100 : 0;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-2.5 text-[13px]">
        <span className="truncate font-bold">{nombre}</span>
        <span className="whitespace-nowrap text-ink-3">{etapa}</span>
      </div>
      <ProgressBar porcentaje={pct} tono={hechos >= total && total > 0 ? "pri" : "sky"} />
      <div className="font-tabular text-[11.5px] text-ink-3">
        {hechos}/{total} requisitos
        {dias !== undefined && ` · cierra en ${dias} d`}
      </div>
    </div>
  );
}
