import { cn } from "@/lib/utils";

const tonos = {
  tipo_proyecto: "bg-pri-soft text-pri-text",
  sector: "bg-pri-soft text-pri-text",
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
        "inline-flex items-center rounded-[3px] px-2 py-1 text-xs font-semibold",
        tonos[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
