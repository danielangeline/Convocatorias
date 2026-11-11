import Link from "next/link";
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
        <span className={`grid h-8 w-8 place-items-center rounded-[4px] ${TONO_CLASE[tono]}`}>
          <Icono className="h-4 w-4" aria-hidden />
        </span>
      </div>
      <div className="font-tabular text-[28px] font-medium leading-none">
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

/**
 * Franja de KPI del Inicio: una sola tarjeta con divisores. Cada celda puede
 * ser un enlace. Se arma con `KpiCelda`; el contenedor deja ver el borde de la
 * tarjeta entre celdas (`gap-px`).
 */
export function KpiFranja({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px overflow-hidden rounded-md border border-line bg-line">
      {children}
    </div>
  );
}

export function KpiCelda({
  etiqueta,
  valor,
  sufijo,
  nota,
  href,
}: {
  etiqueta: string;
  valor: React.ReactNode;
  sufijo?: string;
  nota?: React.ReactNode;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="text-[12.5px] font-semibold text-ink-2">{etiqueta}</span>
      <span className="font-tabular text-[28px] font-medium leading-none text-ink">
        {valor}
        {sufijo && <span className="text-sm text-ink-3">{sufijo}</span>}
      </span>
      {nota && <span className="text-xs text-ink-3">{nota}</span>}
    </>
  );
  const clase = "flex min-h-[112px] flex-col justify-between gap-3 bg-surface p-5";
  return href ? (
    <Link href={href} className={`${clase} transition-colors hover:bg-surface-2`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}
