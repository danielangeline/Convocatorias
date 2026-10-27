export interface SemanaBarra {
  etiqueta: string;
  valor: number;
}

/** 12 barras semanales; la última en pri, las demás atenuadas. */
export function WeeklyBars({
  semanas,
  variacion,
  fechasReferencia,
  etiquetaAccesible,
}: {
  semanas: SemanaBarra[];
  /** Texto ya formateado, p. ej. "+18% vs. trimestre anterior". Omitir si no hay base. */
  variacion?: string;
  fechasReferencia?: [string, string, string];
  etiquetaAccesible: string;
}) {
  const total = semanas.reduce((s, x) => s + x.valor, 0);
  const max = Math.max(0, ...semanas.map((s) => s.valor));
  if (semanas.length === 0 || max === 0) {
    return <p className="py-10 text-center text-[13px] text-ink-3">Aún no hay postulaciones para graficar.</p>;
  }
  return (
    <figure className="m-0">
      <div className="mb-3 flex items-baseline justify-end gap-3">
        {variacion && <span className="text-xs font-semibold text-pri-text">{variacion}</span>}
        <span className="font-tabular text-xl font-semibold">{total}</span>
      </div>
      <div role="img" aria-label={etiquetaAccesible} className="flex h-[180px] items-end gap-2">
        {semanas.map((s, i) => {
          const ultima = i === semanas.length - 1;
          return (
            <div
              key={`${s.etiqueta}-${i}`}
              title={`${s.etiqueta}: ${s.valor}`}
              className="crece-alto flex-1 rounded-t-[5px]"
              style={{
                height: `${Math.max(2, (s.valor / max) * 100)}%`,
                background: ultima
                  ? "var(--pri)"
                  : "color-mix(in oklch, var(--pri) 35%, var(--surface-2))",
              }}
            />
          );
        })}
      </div>
      {fechasReferencia && (
        <div className="mt-2 flex justify-between text-xs text-ink-3">
          {fechasReferencia.map((f) => (
            <span key={f}>{f}</span>
          ))}
        </div>
      )}
      <table className="sr-only">
        <caption>{etiquetaAccesible}</caption>
        <tbody>
          {semanas.map((s, i) => (
            <tr key={i}>
              <td>{s.etiqueta}</td>
              <td>{s.valor}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
