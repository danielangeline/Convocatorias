export function Campo({
  etiqueta,
  ayuda,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-3">{etiqueta}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-pri focus:ring-2 focus:ring-pri-soft bg-surface text-ink"
      />
      {ayuda && <span className="mt-1 block text-xs text-ink-3">{ayuda}</span>}
    </label>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "exito" | "advertencia"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "exito" ? "status" : "alert"}
      className={
        tipo === "error"
          ? "rounded-lg bg-rose/10 px-3 py-2.5 text-sm text-rose-ink"
          : tipo === "advertencia"
            ? "rounded-lg bg-amber/10 px-3 py-2.5 text-sm text-amber-ink"
            : "rounded-lg bg-violet/10 px-3 py-2.5 text-sm text-violet-ink"
      }
    >
      {children}
    </p>
  );
}
