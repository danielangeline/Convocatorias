import { cn } from "@/lib/utils";

type Tono = "pri" | "sky" | "violet" | "amber" | "rose";

const relleno: Record<Tono, string> = {
  pri: "bg-pri",
  sky: "bg-sky",
  violet: "bg-violet",
  amber: "bg-amber",
  rose: "bg-rose",
};

export function ProgressBar({
  porcentaje,
  className,
  tono = "pri",
  altura = 6,
}: {
  porcentaje: number;
  className?: string;
  tono?: Tono;
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
