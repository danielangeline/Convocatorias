import {
  Building2,
  Search,
  ClipboardCheck,
  LineChart,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { convocatorias, consultores } from "@/lib/mock-data";
import { formatCOP, diasRestantes } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { ContadorAnimado } from "@/components/ContadorAnimado";

const vigentes = convocatorias.filter((c) => c.estado === "publicada" && diasRestantes(c.fechaCierre) >= 0);
const destacadas = [...vigentes].sort((a, b) => diasRestantes(a.fechaCierre) - diasRestantes(b.fechaCierre)).slice(0, 3);

const montoTotalDisponible = vigentes.reduce((acc, c) => acc + c.montoMax, 0);
const entidadesConvocantes = new Set(convocatorias.map((c) => c.entidadConvocante)).size;
const consultoresAprobados = consultores.filter((c) => c.estadoPerfil === "aprobado" && !c.esEquipoInterno).length;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="border-b border-line-soft">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-800 text-white">
              <Building2 className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="hidden font-display text-[15px] font-bold leading-none text-ink min-[420px]:inline">
              Gestión de
              <br />
              Convocatorias
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <LinkButton href="/login" variant="ghost" size="sm" className="whitespace-nowrap">
              Iniciar sesión
            </LinkButton>
            <LinkButton href="/registro" variant="primary" size="sm" className="whitespace-nowrap">
              Crear cuenta<span className="hidden sm:inline"> gratis</span>
            </LinkButton>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-line-soft bg-primary-50/50">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-8 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-50 px-3 py-1 text-xs font-semibold text-gold-700 ring-1 ring-gold-100">
              Hecho para empresas colombianas
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-primary-950 sm:text-5xl">
              La financiación de tu empresa, en un solo expediente.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Encuentra convocatorias de Minciencias, cámaras de comercio,
              cooperación internacional y fondos regionales. Postúlate,
              cumple los requisitos y haz seguimiento sin perder el hilo.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/convocatorias" variant="primary" size="lg">
                Explorar convocatorias <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/registro" variant="outline-gold" size="lg">
                Crear cuenta
              </LinkButton>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
              <div>
                <ContadorAnimado valor={vigentes.length} />
                <p className="text-xs text-ink-faint">Convocatorias vigentes</p>
              </div>
              <div>
                <ContadorAnimado valor={montoTotalDisponible} variante="cop-corto" />
                <p className="text-xs text-ink-faint">Monto total disponible</p>
              </div>
              <div>
                <ContadorAnimado valor={entidadesConvocantes} />
                <p className="text-xs text-ink-faint">Entidades convocantes</p>
              </div>
              <div>
                <ContadorAnimado valor={consultoresAprobados} />
                <p className="text-xs text-ink-faint">Consultores aprobados</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {destacadas.map((c) => {
              const dias = diasRestantes(c.fechaCierre);
              return (
                <div
                  key={c.id}
                  className="rounded-2xl border border-line bg-white p-4 shadow-[0_16px_40px_-24px_rgba(31,56,100,0.4)]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">
                      Cierra en {dias} {dias === 1 ? "día" : "días"}
                    </p>
                  </div>
                  <p className="mt-1 font-display text-sm font-semibold text-ink">{c.nombre}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{c.entidadConvocante}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-line-soft pt-3 text-xs">
                    <span className="font-tabular font-semibold text-primary-800">
                      {formatCOP(c.montoMax)}
                    </span>
                    <span className="flex items-center gap-1 text-ink-faint">
                      <MapPin className="h-3 w-3" /> {c.ubicacion}
                    </span>
                  </div>
                </div>
              );
            })}
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
            <div key={titulo} className="rounded-2xl border border-line-soft p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-800 text-white">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink">{titulo}</h3>
              <p className="mt-2 text-sm text-ink-soft">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-line-soft bg-primary-950">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Tu próxima fuente de financiación puede estar a un clic
          </h2>
          <p className="max-w-xl text-white/70">
            Crea tu cuenta gratuita y empieza a comparar convocatorias hechas
            para empresas como la tuya.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <LinkButton href="/registro" variant="outline-gold" size="lg">
              Crear cuenta gratis
            </LinkButton>
            <LinkButton
              href="/login"
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10"
            >
              Ya tengo cuenta
            </LinkButton>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-soft py-6 text-center text-xs text-ink-faint">
        Plataforma de Gestión de Convocatorias — prototipo visual, datos de ejemplo.
      </footer>
    </div>
  );
}
