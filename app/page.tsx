import Link from "next/link";
import {
  Building2,
  HardHat,
  Search,
  ClipboardCheck,
  LineChart,
  ArrowRight,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ContadorAnimado } from "@/components/ContadorAnimado";
import { haySesion } from "@/lib/auth";
import { obtenerIndicadores } from "@/lib/catalogo";


const PUERTAS = [
  {
    puerta: "empresa",
    titulo: "Soy empresa o entidad",
    texto: "Busca convocatorias, genera el documento base de tu postulación con IA y contrata consultores. Prueba gratis 7 días.",
    icono: Building2,
    tono: "primary",
  },
  {
    puerta: "consultor",
    titulo: "Soy consultor",
    texto: "Publica tu perfil y recibe encargos de empresas que preparan sus postulaciones. Tu perfil pasa por revisión.",
    icono: HardHat,
    tono: "consultor",
  },
] as const;

export default async function LandingPage() {
  // RF-44: cifras reales, calculadas en el servidor con caché de 1 hora. Si no
  // se pueden calcular, no se muestran: una cifra inventada es peor que ninguna.
  const [conSesion, indicadores] = await Promise.all([haySesion(), obtenerIndicadores()]);

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="border-b border-line-2">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {conSesion ? (
              // RF-84: /login lleva a cada cuenta al portal de su rol (y al administrador sin MFA, a /mfa).
              <LinkButton href="/login" variant="primary" size="sm" className="whitespace-nowrap">
                Ir a mi portal <ArrowRight className="h-4 w-4" />
              </LinkButton>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" size="sm" className="whitespace-nowrap">
                  Iniciar sesión
                </LinkButton>
                <LinkButton href="/registro" variant="primary" size="sm" className="whitespace-nowrap">
                  Crear cuenta
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line-2 bg-pri-soft/50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber-ink ring-1 ring-amber/30">
              Hecho para empresas y entidades colombianas
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl">
              La financiación de tu empresa, en un solo expediente.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-2">
              Encuentra convocatorias de Minciencias, cámaras de comercio,
              cooperación internacional y fondos regionales. Postúlate,
              cumple los requisitos y haz seguimiento sin perder el hilo.
            </p>
            {indicadores && (
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
              <div>
                <ContadorAnimado valor={indicadores.convocatoriasVigentes} />
                <p className="text-xs text-ink-3">Convocatorias vigentes</p>
              </div>
              <div>
                <ContadorAnimado valor={indicadores.montoDisponible} variante="cop-corto" />
                <p className="text-xs text-ink-3">Monto total disponible</p>
              </div>
              <div>
                <ContadorAnimado valor={indicadores.entidades} />
                <p className="text-xs text-ink-3">Entidades convocantes</p>
              </div>
              <div>
                <ContadorAnimado valor={indicadores.consultoresAprobados} />
                <p className="text-xs text-ink-3">Consultores aprobados</p>
              </div>
            </div>
            )}
          </div>

          {/* RF-84: las dos puertas. Ninguna convocatoria individual a la vista sin cuenta de empresa (RN-33) */}
          <div className="space-y-4">
            {PUERTAS.map(({ puerta, titulo, texto, icono: Icono, tono }) => (
              <div
                key={puerta}
                className="rounded-2xl border border-line bg-surface p-5 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      tono === "primary"
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pri text-on-pri"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky text-white"
                    }
                  >
                    <Icono className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h2 className="font-display text-lg font-bold text-ink">{titulo}</h2>
                </div>
                <p className="mt-3 text-sm text-ink-2">{texto}</p>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <LinkButton href={`/registro?puerta=${puerta}`} variant={tono === "primary" ? "primary" : "consultor"}>
                    Crear cuenta <ArrowRight className="h-4 w-4" />
                  </LinkButton>
                  <Link
                    href={`/login?puerta=${puerta}`}
                    className={
                      tono === "primary"
                        ? "text-sm font-semibold text-pri-text hover:underline"
                        : "text-sm font-semibold text-sky-ink hover:underline"
                    }
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-2xl font-bold text-ink sm:text-3xl">
          De la búsqueda a la postulación, sin hojas de cálculo sueltas
        </h2>
        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: Search,
              titulo: "Encuentra",
              texto:
                "Filtra por sector, tipo de proyecto, entidad, monto y ubicación entre convocatorias verificadas por nuestro equipo.",
            },
            {
              icon: ClipboardCheck,
              titulo: "Postúlate",
              texto:
                "Revisa requisitos y documentos exigidos, arma tu expediente y presenta tu postulación con un checklist claro.",
            },
            {
              icon: LineChart,
              titulo: "Haz seguimiento",
              texto:
                "Consulta el estado de cada postulación y la línea de tiempo completa, desde preparación hasta el resultado final.",
            },
          ].map(({ icon: Icon, titulo, texto }) => (
            <div key={titulo} className="rounded-2xl border border-line-2 p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pri text-on-pri">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{titulo}</h3>
              <p className="mt-2 text-sm text-ink-2">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line-2 bg-pri-soft">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-[-0.025em] text-ink sm:text-3xl">
            Tu próxima fuente de financiación puede estar a un clic
          </h2>
          <p className="max-w-xl text-ink-2">
            Entra por tu puerta: como empresa o entidad para encontrar y preparar
            postulaciones, o como consultor para acompañarlas.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <LinkButton href="/registro?puerta=empresa" variant="outline-amber" size="lg">
              Soy empresa o entidad
            </LinkButton>
            <LinkButton
              href="/registro?puerta=consultor"
              variant="secondary"
              size="lg"
            >
              Soy consultor
            </LinkButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-2 py-6 text-center text-xs text-ink-3">
        Plataforma de Gestión de Convocatorias — las cifras del catálogo se calculan en vivo.
      </footer>
    </div>
  );
}
