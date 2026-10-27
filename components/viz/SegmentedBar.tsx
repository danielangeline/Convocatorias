import { TONO_VAR, type Tono } from "./tonos";

export interface Segmento {
  etiqueta: string;
  valor: number;
  tono: Tono;
}

/** Barra horizontal proporcional con leyenda (punto, etiqueta y valor en mono). */
export function SegmentedBar({
  segmentos,
  etiquetaAccesible,
}: {
  segmentos: Segmento[];
  etiquetaAccesible: string;
}) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0);
  if (total === 0) {
    return <p className="py-6 text-center text-[13px] text-ink-3">Sin datos todavía.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="img" aria-label={etiquetaAccesible} className="flex h-3 gap-0.5 overflow-hidden rounded-md">
        {segmentos
          .filter((s) => s.valor > 0)
          .map((s) => (
            <div
              key={s.etiqueta}
              title={`${s.etiqueta}: ${s.valor}`}
              className="crece-ancho"
              style={{ flex: s.valor, background: TONO_VAR[s.tono] }}
            />
          ))}
      </div>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {segmentos.map((s) => (
          <li key={s.etiqueta} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: TONO_VAR[s.tono] }} />
            <span className="flex-1 text-ink-2">{s.etiqueta}</span>
            <span className="font-tabular font-semibold">{s.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
