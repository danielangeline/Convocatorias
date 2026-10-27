import { Star } from "lucide-react";
import { cn, formatRating } from "@/lib/utils";

export function RatingStars({
  valor,
  totalResenas,
  size = "sm",
  className,
}: {
  valor: number;
  totalResenas?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tamanoIcono = size === "lg" ? "h-5 w-5" : size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const tamanoTexto = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  const redondeado = Math.round(valor);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              tamanoIcono,
              i < redondeado ? "fill-amber text-amber-ink" : "fill-transparent text-line"
            )}
            strokeWidth={1.5}
          />
        ))}
      </div>
      <span className={cn("font-tabular font-semibold text-ink", tamanoTexto)}>
        {formatRating(valor)}
      </span>
      {typeof totalResenas === "number" && (
        <span className={cn("text-ink-3", tamanoTexto)}>
          ({totalResenas} {totalResenas === 1 ? "reseña" : "reseñas"})
        </span>
      )}
    </div>
  );
}
