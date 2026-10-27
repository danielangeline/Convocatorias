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
        {eyebrow && <div className="text-[12.5px] font-semibold text-ink-3">{eyebrow}</div>}
        <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.025em] text-ink sm:text-[28px]">
          {titulo}
        </h1>
        {descripcion && <p className="mt-1.5 text-ink-2 [text-wrap:pretty]">{descripcion}</p>}
      </div>
      {accion && <div className="flex flex-wrap gap-2">{accion}</div>}
    </div>
  );
}
