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
  /** Reemplaza «N días para el cierre» (p. ej. «Radicada hace 6 días»). */
  nota?: string;
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

/** Contenido de una tarjeta de postulación: sirve al tablero y a la lista móvil. */
export function TarjetaPostulacionContenido({ t }: { t: TarjetaKanban }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-line bg-surface p-3.5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[.06em] text-ink-3">{t.entidad}</div>
      <div className="font-display text-[15.5px] font-semibold leading-snug [text-wrap:pretty]">{t.nombre}</div>
      <div className="text-xs text-ink-2">Proyecto: {t.proyecto}</div>
      <ProgressBar altura={4} porcentaje={t.total > 0 ? (t.hechos / t.total) * 100 : 0} />
      <div className="flex items-center justify-between gap-2 text-[11.5px]">
        <span className="font-tabular text-ink-3">
          {t.hechos}/{t.total}
        </span>
        {t.nota ? (
          <span className="text-ink-3">{t.nota}</span>
        ) : (
          t.dias !== null && (
            <span className={t.dias < 10 ? "font-semibold text-rose" : "text-ink-3"}>
              {t.dias === 0 ? "Cierra hoy" : `${t.dias} ${t.dias === 1 ? "día" : "días"} para el cierre`}
            </span>
          )
        )}
      </div>
      {t.consultor && (
        <div className="flex items-center gap-2 border-t border-line-2 pt-2.5 text-xs text-ink-2">
          <span className={`grid h-[22px] w-[22px] place-items-center rounded-full text-[9.5px] font-bold ${TONO_CLASE.pri}`}>
            {iniciales(t.consultor)}
          </span>
          Con {t.consultor}
        </div>
      )}
    </div>
  );
}

/** Tablero por etapa: 4 columnas de 220 px como mínimo sobre `surface-2`. `renderTarjeta` envuelve la tarjeta en un enlace. */
export function KanbanBoard({
  columnas,
  renderTarjeta,
}: {
  columnas: ColumnaKanban[];
  renderTarjeta?: (t: TarjetaKanban, contenido: React.ReactNode) => React.ReactNode;
}) {
  return (
    <div className="grid auto-cols-[minmax(220px,1fr)] grid-flow-col gap-3.5 overflow-x-auto pb-1.5">
      {columnas.map((col) => (
        <section
          key={col.clave}
          aria-label={`${col.titulo}: ${col.tarjetas.length}`}
          className="flex min-h-[320px] flex-col gap-2.5 rounded-md bg-surface-2 p-3"
        >
          <header className="flex items-center gap-2 px-1.5 pb-1.5 pt-1">
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: TONO_VAR[col.tono] }} />
            <h3 className="text-[13px] font-semibold text-ink">{col.titulo}</h3>
            <span className="font-tabular text-xs text-ink-3">{col.tarjetas.length}</span>
          </header>
          {col.tarjetas.map((t) => {
            const contenido = <TarjetaPostulacionContenido t={t} />;
            return <div key={t.id}>{renderTarjeta ? renderTarjeta(t, contenido) : contenido}</div>;
          })}
          {col.tarjetas.length === 0 && <p className="px-1.5 text-xs text-ink-3">Nada en esta etapa.</p>}
        </section>
      ))}
    </div>
  );
}
