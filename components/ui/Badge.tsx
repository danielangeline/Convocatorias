import { cn } from "@/lib/utils";

export type TonoBadge = "pri" | "amber" | "violet" | "sky" | "rose" | "neutro";

const tonos: Record<TonoBadge, string> = {
  pri: "bg-pri-soft text-pri-text",
  amber: "bg-[color-mix(in_oklch,var(--amber)_16%,transparent)] text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))]",
  violet: "bg-[color-mix(in_oklch,var(--violet)_16%,transparent)] text-[color-mix(in_oklch,var(--violet)_65%,var(--ink))]",
  sky: "bg-[color-mix(in_oklch,var(--sky)_16%,transparent)] text-[color-mix(in_oklch,var(--sky)_65%,var(--ink))]",
  rose: "bg-[color-mix(in_oklch,var(--rose)_16%,transparent)] text-[color-mix(in_oklch,var(--rose)_65%,var(--ink))]",
  neutro: "bg-surface-2 text-ink-2",
};

// `tono` es opcional: los usos existentes pasan clases de estado (lib/utils.ts)
// por `className` y siguen funcionando.
export function Badge({
  children,
  className,
  tono,
}: {
  children: React.ReactNode;
  className?: string;
  tono?: TonoBadge;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap",
        tono && tonos[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
