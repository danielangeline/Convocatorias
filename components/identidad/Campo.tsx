export function Campo({
  etiqueta,
  ayuda,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; ayuda?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">{etiqueta}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-line px-3 py-2.5 text-sm text-ink outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
      />
      {ayuda && <span className="mt-1 block text-xs text-ink-faint">{ayuda}</span>}
    </label>
  );
}

export function Aviso({ tipo, children }: { tipo: "error" | "exito"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "error" ? "alert" : "status"}
      className={
        tipo === "error"
          ? "rounded-lg bg-red-50 px-3 py-2.5 text-sm text-danger"
          : "rounded-lg bg-teal-50 px-3 py-2.5 text-sm text-teal-800"
      }
    >
      {children}
    </p>
  );
}
