import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONO_CLASE, type Tono } from "./tonos";

export function KpiCard({
  etiqueta,
  valor,
  sufijo,
  nota,
  icono: Icono,
  tono = "pri",
}: {
  etiqueta: string;
  valor: React.ReactNode;
  sufijo?: string;
  nota?: React.ReactNode;
  icono: LucideIcon;
  tono?: Tono;
}) {
  return (
    <Card className="flex flex-col gap-3 p-[18px]">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-semibold text-ink-2">{etiqueta}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-[9px] ${TONO_CLASE[tono]}`}>
          <Icono className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="font-tabular text-[28px] font-semibold leading-none tracking-[-0.03em]">
        {valor}
        {sufijo && <span className="text-sm font-medium text-ink-3">{sufijo}</span>}
      </div>
      {nota && <div className="text-xs text-ink-3">{nota}</div>}
    </Card>
  );
}

/** Fila de KPI: `grid auto-fit minmax(220px,1fr)`. */
export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">{children}</div>;
}
