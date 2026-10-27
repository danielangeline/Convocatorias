import { ProgressBar } from "@/components/ui/ProgressBar";
import { TONO_CLASE, TONO_VAR, type Tono } from "./tonos";

export interface TarjetaKanban {
  id: string;
  entidad: string;
  nombre: string;
  proyecto: string;
  hechos: number;
  total: number;
  dias: number | null;
  consultor?: string;
  href?: string;
}

export interface ColumnaKanban {
  clave: string;
  titulo: string;
  tono: Tono;
  tarjetas: TarjetaKanban[];
}

function iniciales(nombre: string) {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/** Tablero por estado. `renderTarjeta` permite envolver la tarjeta en un enlace. */
export function KanbanBoard({
  columnas,
  renderTarjeta,
}: {
  columnas: ColumnaKanban[];
  renderTarjeta?: (t: TarjetaKanban, contenido: React.ReactNode) => React.ReactNode;
}) {
  return (
    <div className="grid grid-flow-col auto-cols-[minmax(240px,1fr)] gap-3.5 overflow-x-auto pb-1.5">
      {columnas.map((col) => (
        <section
          key={col.clave}
          aria-label={`${col.titulo}: ${col.tarjetas.length}`}
          className="flex min-h-[420px] flex-col gap-2.5 rounded-2xl bg-surface-2 p-3"
        >
          <header className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
            <span className="h-2 w-2 rounded-full" style={{ background: TONO_VAR[col.tono] }} />
            <h3 className="text-[13px] font-extrabold">{col.titulo}</h3>
            <span className="font-tabular text-xs text-ink-3">{col.tarjetas.length}</span>
          </header>
          {col.tarjetas.map((t) => {
            const urgencia =
              t.dias === null ? "neutro" : t.dias < 10 ? "rose" : t.dias < 15 ? "amber" : "neutro";
            const contenido = (
              <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-surface p-3.5 shadow-card">
                <div className="text-[11.5px] font-semibold text-ink-3">{t.entidad}</div>
                <div className="text-[13.5px] font-bold leading-snug [text-wrap:pretty]">{t.nombre}</div>
                <div className="text-xs text-ink-2">Proyecto: {t.proyecto}</div>
                <ProgressBar
                  altura={5}
                  porcentaje={t.total > 0 ? (t.hechos / t.total) * 100 : 0}
                  tono={t.total > 0 && t.hechos >= t.total ? "pri" : "sky"}
                />
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-tabular text-ink-3">
                    {t.hechos}/{t.total} requisitos
                  </span>
                  {t.dias !== null && (
                    <span className={`rounded-md px-1.5 py-0.5 font-bold ${TONO_CLASE[urgencia]}`}>
                      {t.dias} d
                    </span>
                  )}
                </div>
                {t.consultor && (
                  <div className="flex items-center gap-2 border-t border-line-2 pt-2.5 text-xs text-ink-2">
                    <span
                      className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[9.5px] font-extrabold ${TONO_CLASE.sky}`}
                    >
                      {iniciales(t.consultor)}
                    </span>
                    Con {t.consultor}
                  </div>
                )}
              </div>
            );
            return (
              <div key={t.id}>{renderTarjeta ? renderTarjeta(t, contenido) : contenido}</div>
            );
          })}
          {col.tarjetas.length === 0 && (
            <p className="px-1.5 text-xs text-ink-3">Nada en este estado.</p>
          )}
        </section>
      ))}
    </div>
  );
}
