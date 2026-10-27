import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      {children}
    </Tag>
  );
}

/** Encabezado de tarjeta: título 15/800, subtítulo opcional y acción a la derecha. */
export function CardHeader({
  titulo,
  subtitulo,
  accion,
  className,
}: {
  titulo: React.ReactNode;
  subtitulo?: React.ReactNode;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-extrabold text-ink">{titulo}</h2>
        {subtitulo && <p className="mt-[3px] text-[12.5px] text-ink-3">{subtitulo}</p>}
      </div>
      {accion}
    </div>
  );
}
