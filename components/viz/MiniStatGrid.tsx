import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface MiniStat {
  etiqueta: string;
  valor: string | number;
}

/** Rejilla 2×2 de tiles; con `titulo` se arma la tarjeta de consumo de IA. */
export function MiniStatGrid({ stats, titulo }: { stats: MiniStat[]; titulo?: string }) {
  const rejilla = (
    <div className="grid grid-cols-2 gap-2.5">
      {stats.map((s) => (
        <div key={s.etiqueta} className="rounded-xl bg-surface-2 p-3">
          <div className="font-tabular text-[19px] font-semibold">{s.valor}</div>
          <div className="mt-0.5 text-[11.5px] text-ink-3">{s.etiqueta}</div>
        </div>
      ))}
    </div>
  );
  if (!titulo) return rejilla;
  return (
    <Card className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2 text-[15px] font-extrabold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--violet)_16%,transparent)] text-violet">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        {titulo}
      </div>
      {rejilla}
    </Card>
  );
}
