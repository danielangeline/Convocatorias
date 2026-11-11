import { cn } from "@/lib/utils";

// ok/aviso/error/neutro son los tonos del rediseño; pri, amber y rose se conservan
// como alias para los usos existentes.
export type TonoBadge = "ok" | "aviso" | "error" | "neutro" | "pri" | "amber" | "rose";

const tonos: Record<TonoBadge, string> = {
  ok: "bg-pri-soft text-pri-text",
  aviso: "bg-amber-soft text-ink",
  error: "bg-rose-soft text-rose",
  neutro: "bg-surface-2 text-ink-2",
  pri: "bg-pri-soft text-pri-text",
  amber: "bg-amber-soft text-ink",
  rose: "bg-rose-soft text-rose",
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
        "inline-flex items-center gap-1 rounded-[3px] px-2 py-1 text-[11px] font-semibold whitespace-nowrap",
        tono && tonos[tono],
        className
      )}
    >
      {children}
    </span>
  );
}
