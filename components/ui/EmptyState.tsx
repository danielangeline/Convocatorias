import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  titulo,
  descripcion,
  accion,
}: {
  icon: LucideIcon;
  titulo: string;
  descripcion: string;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pri-soft text-pri-text">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-extrabold text-ink">{titulo}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-ink-2">{descripcion}</p>
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
