/** Campo de formulario de Identidad: 48 px, borde `line-strong`, etiqueta con acción opcional en línea (p. ej. «¿La olvidó?»). */
export function Campo({
  etiqueta,
  ayuda,
  accion,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string; accion?: React.ReactNode }) {
  return (
    <div className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={props.id ?? props.name} className="text-[13px] font-semibold text-ink">
          {etiqueta}
        </label>
        {accion}
      </div>
      <input
        id={props.id ?? props.name}
        {...props}
        className="h-12 w-full rounded-[4px] border border-line-strong bg-surface px-3 text-[15px] text-ink outline-none focus:border-pri focus:ring-2 focus:ring-pri-soft"
      />
      {ayuda && <span className="mt-1 block text-xs text-ink-3">{ayuda}</span>}
    </div>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "exito" | "advertencia"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "exito" ? "status" : "alert"}
      className={
        tipo === "error"
          ? "rounded-[4px] bg-rose-soft px-3 py-2.5 text-sm text-rose"
          : tipo === "advertencia"
            ? "rounded-[4px] bg-amber-soft px-3 py-2.5 text-sm text-ink"
            : "rounded-[4px] bg-pri-soft px-3 py-2.5 text-sm text-pri-text"
      }
    >
      {children}
    </p>
  );
}
