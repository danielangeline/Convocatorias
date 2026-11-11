import { cn } from "@/lib/utils";

/** Título, una línea de contexto y como máximo una acción primaria. */
export function PageHeader({
  titulo,
  descripcion,
  eyebrow,
  accion,
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  eyebrow?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="text-xs font-semibold uppercase tracking-[.08em] text-pri-text">{eyebrow}</div>}
        <h1 className="mt-1 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink sm:text-[32px]">
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 text-ink-2 [text-wrap:pretty]">{descripcion}</p>}
      </div>
      {accion && <div className="flex flex-wrap gap-2">{accion}</div>}
    </div>
  );
}
