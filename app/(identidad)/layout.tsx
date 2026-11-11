import Link from "next/link";
import { LogoMarca } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { obtenerIndicadores } from "@/lib/catalogo";
import { formatCOPCorto } from "@/lib/utils";

// Identidad (login, registro, MFA, recuperar, definir contraseña): pantalla
// partida. Izquierda, la banda oscura de marca con tres cifras reales (RF-44,
// las mismas de la landing); derecha, el formulario. En móvil se apilan.
// En Identidad se trata de «usted», como en la landing; en los portales, de «tú».
export default async function IdentidadLayout({ children }: { children: React.ReactNode }) {
  // RF-44: si no se pueden calcular, la banda no muestra cifras (una inventada es peor que ninguna).
  const indicadores = await obtenerIndicadores();

  return (
    <div className="flex min-h-screen flex-wrap bg-bg">
      <section
        aria-label="FundRadar"
        className="flex flex-[1_1_460px] flex-col justify-between gap-6 bg-[#0a1a22] px-6 py-6 text-white sm:gap-10 sm:px-12 sm:py-12"
      >
        <Link href="/" aria-label="FundRadar, ir al inicio" className="inline-flex items-center gap-2.5 self-start">
          <LogoMarca className="text-[#7cc3d2]" />
          <span className="font-display text-[22px] font-semibold leading-none">FundRadar</span>
        </Link>

        <div>
          {indicadores && (
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.08em] text-[#f2a93b]">
              <span aria-hidden className="relative h-2 w-2 flex-none">
                <span className="ping-ring absolute inset-0 rounded-full bg-[#f2a93b]" />
                <span className="absolute inset-0 rounded-full bg-[#f2a93b]" />
              </span>
              {indicadores.convocatoriasVigentes.toLocaleString("es-CO")} convocatorias vigentes hoy
            </p>
          )}
          <p className="mt-4 max-w-[520px] font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] sm:text-[40px]">
            ¿A qué financiación puede postular su organización hoy?
          </p>
          <p className="mt-4 hidden max-w-[480px] text-[15px] sm:block leading-[1.55] text-[#c9d3dd] [text-wrap:pretty]">
            Encuentre convocatorias públicas, privadas y de cooperación, prepare su postulación y haga seguimiento sin
            perder el hilo.
          </p>
        </div>

        {indicadores && (
          <dl className="m-0 hidden grid-cols-3 gap-4 border-t border-white/15 pt-6 sm:grid">
            {[
              { valor: indicadores.convocatoriasVigentes.toLocaleString("es-CO"), etiqueta: "Convocatorias vigentes" },
              { valor: formatCOPCorto(indicadores.montoDisponible), etiqueta: "Monto disponible" },
              { valor: indicadores.entidades.toLocaleString("es-CO"), etiqueta: "Entidades convocantes" },
            ].map((c) => (
              <div key={c.etiqueta}>
                <dd className="font-tabular m-0 text-2xl font-medium text-[#f2a93b]">{c.valor}</dd>
                <dt className="mt-1 text-xs text-[#c9d3dd]">{c.etiqueta}</dt>
              </div>
            ))}
          </dl>
        )}
      </section>

      <div className="flex flex-[1_1_460px] flex-col">
        <div className="flex justify-end px-4 pt-4 sm:px-6">
          <ThemeToggle />
        </div>
        <main className="flex flex-1 items-start justify-center px-4 pb-10 pt-6 sm:items-center sm:px-6 sm:pt-0">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
