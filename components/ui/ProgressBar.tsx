import { cn } from "@/lib/utils";

type Tono = "pri" | "sky" | "violet" | "amber" | "rose";
// Los tonos viejos siguen aceptándose mientras las pantallas migran.
type TonoLegado = "primary" | "gold" | "teal" | "danger" | "warning" | "success";

const relleno: Record<Tono | TonoLegado, string> = {
  pri: "bg-pri",
  sky: "bg-sky",
  violet: "bg-violet",
  amber: "bg-amber",
  rose: "bg-rose",
  primary: "bg-pri",
  gold: "bg-amber",
  teal: "bg-violet",
  danger: "bg-rose",
  warning: "bg-amber",
  success: "bg-pri",
};

export function ProgressBar({
  porcentaje,
  className,
  tono = "pri",
  altura = 6,
}: {
  porcentaje: number;
  className?: string;
  tono?: Tono | TonoLegado;
  altura?: number;
}) {
  const valor = Math.max(0, Math.min(100, porcentaje));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-surface-2", className)}
      style={{ height: altura }}
      role="progressbar"
      aria-valuenow={valor}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("crece-ancho h-full rounded-full", relleno[tono])}
        style={{ width: `${valor}%` }}
      />
    </div>
  );
}
