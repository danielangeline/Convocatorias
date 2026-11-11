import { cn } from "@/lib/utils";

export interface Columna<T> {
  clave: string;
  titulo: string;
  /** Ancho de la columna en la rejilla (`minmax(0,1fr)` por defecto). */
  ancho?: string;
  alinear?: "izquierda" | "derecha";
  celda: (fila: T) => React.ReactNode;
}

/**
 * Tabla en rejilla CSS: encabezado en mayúsculas 11/700, filas de 14 px de
 * padding vertical y separadores `line-2`. Con scroll horizontal en móvil.
 */
export function DataTable<T>({
  columnas,
  filas,
  clave,
  alHacerClic,
  vacio,
  etiqueta,
}: {
  columnas: Columna<T>[];
  filas: T[];
  clave: (fila: T) => string;
  alHacerClic?: (fila: T) => void;
  vacio?: React.ReactNode;
  etiqueta: string;
}) {
  const plantilla = columnas.map((c) => c.ancho ?? "minmax(0,1fr)").join(" ");
  const minimo = Math.max(560, columnas.length * 130);
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="overflow-x-auto">
        <div role="table" aria-label={etiqueta} style={{ minWidth: minimo }}>
          <div
            role="row"
            style={{ gridTemplateColumns: plantilla }}
            className="grid gap-3.5 border-b border-line bg-surface-2 px-[18px] py-3 text-xs font-semibold uppercase tracking-[.06em] text-ink-3"
          >
            {columnas.map((c) => (
              <span
                key={c.clave}
                role="columnheader"
                className={c.alinear === "derecha" ? "text-right" : undefined}
              >
                {c.titulo}
              </span>
            ))}
          </div>
          {filas.length === 0 && vacio}
          {filas.map((f) => (
            <div
              key={clave(f)}
              role="row"
              tabIndex={alHacerClic ? 0 : undefined}
              onClick={alHacerClic ? () => alHacerClic(f) : undefined}
              onKeyDown={
                alHacerClic ? (e) => (e.key === "Enter" ? alHacerClic(f) : undefined) : undefined
              }
              style={{ gridTemplateColumns: plantilla }}
              className={cn(
                "grid items-center gap-3.5 border-b border-line-2 px-[18px] py-3.5 text-[13px] last:border-b-0",
                alHacerClic && "cursor-pointer hover:bg-surface-2"
              )}
            >
              {columnas.map((c) => (
                <div
                  key={c.clave}
                  role="cell"
                  className={cn("min-w-0", c.alinear === "derecha" && "text-right")}
                >
                  {c.celda(f)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
