import { montoCorto } from "./tonos";

export interface BarraApilada {
  etiqueta: string;
  publico: number;
  privado: number;
}

/**
 * Barras verticales apiladas: público (pri) abajo y privado (sky) arriba.
 * Las alturas se escalan contra el máximo de la serie. Sin datos no se pinta.
 */
export function StackedBarChart({
  datos,
  etiquetaAccesible,
  unaSerie = false,
  etiquetaPrivado = "Privados",
  formatear = montoCorto,
}: {
  datos: BarraApilada[];
  etiquetaAccesible: string;
  /** Sin distinción público/privado (si el dato no existe): solo la serie pri y sin leyenda. */
  unaSerie?: boolean;
  etiquetaPrivado?: string;
  /** Cómo se escribe cada total (por defecto, abreviado en M o mM). */
  formatear?: (valor: number) => string;
}) {
  const max = Math.max(0, ...datos.map((d) => d.publico + d.privado));
  if (datos.length === 0 || max === 0) {
    return <p className="py-10 text-center text-[13px] text-ink-3">Aún no hay montos para graficar.</p>;
  }
  const alto = 200 - 28; // 200 px de la gráfica menos la cifra superior
  return (
    <figure className="m-0">
      <div className={`mb-3 flex justify-end gap-3 text-xs text-ink-2 ${unaSerie ? "hidden" : ""}`}>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-pri" />
          Públicos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-sky" />
          {etiquetaPrivado}
        </span>
      </div>
      <div
        role="img"
        aria-label={etiquetaAccesible}
        className="flex h-[200px] items-end gap-3.5 border-b border-line pt-2"
      >
        {datos.map((d) => {
          const total = d.publico + d.privado;
          const hPub = (d.publico / max) * alto;
          const hPriv = (d.privado / max) * alto;
          return (
            <div key={d.etiqueta} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="font-tabular text-[11px] text-ink-2">{formatear(total)}</span>
              <div className="flex w-full max-w-[46px] flex-col gap-[3px]">
                {hPriv > 0 && (
                  <div
                    className="crece-alto rounded-t-md rounded-b-[3px] bg-sky"
                    style={{ height: Math.max(3, hPriv) }}
                    title={`${etiquetaPrivado}: ${formatear(d.privado)} COP`}
                  />
                )}
                {hPub > 0 && (
                  <div
                    className="crece-alto rounded-b-[3px] bg-pri"
                    style={{
                      height: Math.max(3, hPub),
                      borderTopLeftRadius: hPriv > 0 ? 3 : 6,
                      borderTopRightRadius: hPriv > 0 ? 3 : 6,
                    }}
                    title={`Públicos: ${formatear(d.publico)} COP`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3.5">
        {datos.map((d) => (
          <span key={d.etiqueta} className="flex-1 text-center text-xs font-semibold text-ink-3">
            {d.etiqueta}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{etiquetaAccesible}</caption>
        <thead>
          <tr>
            <th>Mes</th>
            <th>Públicos</th>
            <th>{etiquetaPrivado}</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.etiqueta}>
              <td>{d.etiqueta}</td>
              <td>{formatear(d.publico)}</td>
              <td>{formatear(d.privado)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
