/**
 * Anillo con `conic-gradient`: pri si el valor es ≥ 80, amber si es menor.
 * 44 px en tarjetas y 84 px en el perfil. `fondo` es el color del disco
 * interior (el de la superficie donde se apoya).
 */
export function CompatRing({
  porcentaje,
  tamano = 44,
  fondo = "var(--surface)",
  etiqueta = "Compatibilidad",
}: {
  porcentaje: number;
  tamano?: number;
  fondo?: string;
  etiqueta?: string;
}) {
  const valor = Math.max(0, Math.min(100, Math.round(porcentaje)));
  const color = valor >= 80 ? "var(--pri)" : "var(--amber)";
  const grosor = tamano >= 70 ? 8 : 6;
  return (
    <div
      role="img"
      aria-label={`${etiqueta}: ${valor}%`}
      className="grid flex-none place-items-center rounded-full"
      style={{
        width: tamano,
        height: tamano,
        background: `conic-gradient(${color} ${valor * 3.6}deg, var(--surface-2) 0)`,
      }}
    >
      <div
        className="font-tabular grid place-items-center rounded-full font-semibold"
        style={{
          width: tamano - grosor * 2,
          height: tamano - grosor * 2,
          background: fondo,
          fontSize: tamano >= 70 ? 20 : 11.5,
        }}
      >
        {valor}%
      </div>
    </div>
  );
}
