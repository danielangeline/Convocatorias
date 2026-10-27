import { cn } from "@/lib/utils";

const tonos = {
  tipo_proyecto: "bg-pri-soft text-pri-text",
  sector: "bg-[color-mix(in_oklch,var(--amber)_16%,transparent)] text-[color-mix(in_oklch,var(--amber)_62%,var(--ink))]",
  tipo_entidad: "bg-surface-2 text-ink-2",
  neutro: "bg-surface-2 text-ink-2",
} as const;

export function Chip({
  children,
  tono = "neutro",
  className,
}: {
  children: React.ReactNode;
  tono?: keyof typeof tonos;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold",
        tonos[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
