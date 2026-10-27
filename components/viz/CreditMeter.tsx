import { ProgressBar } from "@/components/ui/ProgressBar";

/** Tarjeta "Plan · x/y" con barra violeta y la nota de renovación. */
export function CreditMeter({
  plan,
  usados,
  total,
  nota,
}: {
  plan: string;
  usados: number;
  total: number;
  nota?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-bold">{plan}</span>
        <span className="font-tabular text-ink-2">
          {usados}/{total}
        </span>
      </div>
      <ProgressBar porcentaje={total > 0 ? (usados / total) * 100 : 0} tono="violet" />
      {nota && <div className="text-[11.5px] text-ink-3">{nota}</div>}
    </div>
  );
}
