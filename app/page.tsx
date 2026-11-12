import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ClipboardCheck,
  FileSearch,
  FileText,
  HardHat,
  Layers,
  ListChecks,
  PenLine,
  Search,
  Target,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { Logo } from "@/components/shell/Logo";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { ContadorAnimado } from "@/components/ContadorAnimado";
import { PlanesPortada } from "@/components/landing/PlanesPortada";
import { haySesion } from "@/lib/auth";
import { obtenerIndicadores } from "@/lib/catalogo";
import { leerTarifas, listarPlanesDelRol } from "@/lib/suscripcion-servidor";
import { nombreCortoPlan, planQueIncluye } from "@/lib/planes";
import { TARIFAS_POR_DEFECTO, type FuncionPlan, type Plan, type TarifasIA } from "@/lib/types";

/**
 * Portada pública (CU-14, CU-36 · RF-44, RF-82, RF-84 · sesión 042).
 *
 * Enfocada en lo que gana la empresa. Reglas que no se rompen aquí:
 * - Ninguna convocatoria individual sin cuenta de empresa (RN-33): solo cifras agregadas.
 * - Las cifras son las reales del catálogo (RF-44); si no se pueden calcular, no se muestran.
 * - Los planes, sus precios, créditos y funciones se leen de la base (RF-82, RN-41).
 * - La plataforma prepara; la postulación se radica en el portal oficial (RN-19).
 * - Nada de cifras de resultados: no se promete éxito ni se inventan testimonios.
 */

const PROBLEMAS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: Layers,
    titulo: "Convocatorias dispersas",
    texto:
      "Cada entidad publica en su propio portal, con su formato y su calendario. Revisarlos todos cada semana no cabe en la agenda de nadie.",
  },
  {
    icono: FileSearch,
    titulo: "Términos de referencia largos",
    texto:
      "Decenas de páginas para descubrir, al final, que su empresa no cumplía un requisito de elegibilidad de la primera sección.",
  },
  {
    icono: CalendarClock,
    titulo: "Plazos que se vencen",
    texto:
      "Cuando por fin se entera de la convocatoria, faltan pocos días para el cierre y no alcanza a reunir los documentos.",
  },
];

const BENEFICIOS: { icono: LucideIcon; titulo: string; texto: string; funcion?: FuncionPlan }[] = [
  {
    icono: Search,
    titulo: "Todo en un solo lugar",
    texto:
      "Fondos públicos, privados, de cooperación internacional y beneficios tributarios en un catálogo con filtros por sector, monto, ubicación y fecha de cierre.",
  },
  {
    icono: BadgeCheck,
    titulo: "Solo convocatorias verificadas",
    texto:
      "Nuestro equipo revisa cada convocatoria y la publica con su término de referencia oficial adjunto. Nada llega al catálogo sin esa revisión.",
  },
  {
    icono: Target,
    titulo: "Sepa cuáles le aplican",
    texto:
      "Cruzamos los datos de su proyecto con los requisitos de cada convocatoria vigente y le mostramos el porcentaje de compatibilidad y por qué.",
    funcion: "sugerencias",
  },
  {
    icono: PenLine,
    titulo: "Ahorre días de redacción",
    texto:
      "La IA arma el documento base desde su proyecto y el TDR. Lo que no sabe no lo inventa: lo marca como [COMPLETAR] y se lo lista para que usted lo llene.",
    funcion: "documento_ia",
  },
  {
    icono: ListChecks,
    titulo: "Que no se le escape un requisito",
    texto:
      "Al postular, los requisitos de la convocatoria se vuelven un checklist con avance y seguimiento por estados, hasta el resultado.",
    funcion: "postulaciones",
  },
  {
    icono: Users,
    titulo: "Expertos cuando los necesite",
    texto:
      "Consultores aprobados por nuestro equipo para formular su proyecto, revisar el documento o buscar la convocatoria indicada.",
    funcion: "consultores",
  },
];

const PASOS: { titulo: string; texto: string }[] = [
  { titulo: "Cree su cuenta gratis", texto: "Sin tarjeta de crédito y sin fecha de vencimiento." },
  {
    titulo: "Registre su proyecto",
    texto: "Con el formulario o, desde el plan Esencial, contándoselo a la IA por escrito o en voz alta.",
  },
  {
    titulo: "Encuentre las que le aplican",
    texto: "Explore el catálogo o reciba sugerencias ordenadas por compatibilidad con su proyecto.",
  },
  {
    titulo: "Prepare su postulación",
    texto: "Documento base, checklist de requisitos y seguimiento. La radica usted en el portal oficial de la entidad.",
  },
];

const HACEMOS = [
  "Buscar, verificar y publicar convocatorias con su TDR oficial",
  "Calcular la compatibilidad de cada convocatoria con su proyecto",
  "Generar el documento base de la postulación con IA",
  "Organizar el checklist de requisitos y el seguimiento",
  "Conectarlo con consultores aprobados",
];

const NO_HACEMOS = [
  "Radicar la postulación: se presenta en el portal oficial de la entidad convocante",
  "Garantizar resultados: la decisión es de la entidad y el porcentaje de compatibilidad no es una predicción",
  "Inventar datos, cifras o antecedentes de su empresa",
  "Intermediar el pago de los consultores: se acuerda directamente con ellos",
];

function preguntas(tarifas: TarifasIA, planes: Plan[]): { pregunta: string; respuesta: string }[] {
  const n = (v: number) => v.toLocaleString("es-CO");
  const pagos = planes.filter((p) => !p.esGratuito && p.creditosIaMensuales > 0);
  const cupos = pagos.map((p) => `${nombreCortoPlan(p.nombre)} incluye ${n(p.creditosIaMensuales)} al mes`).join(" y ");
  return [
    {
      pregunta: "¿Qué es un crédito de IA?",
      respuesta:
        `Es la unidad con la que se paga cada uso de la IA. Generar un documento base usa ${n(tarifas.generacion)} créditos; crear un proyecto con IA, ${n(tarifas.estructuracion)}; editar un apartado del proyecto, ${n(tarifas.edicion_apartado)}, y cada ajuste del documento desde el cuarto, ${n(tarifas.ajuste)}. Los tres primeros ajustes de cada documento y dictar no cuestan, y si la IA falla no se descuenta nada.` +
        (cupos ? ` ${cupos}; los créditos se renuevan cada mes y no se acumulan.` : ""),
    },
    {
      pregunta: "¿La IA puede inventar datos de mi empresa?",
      respuesta:
        "No. Solo usa lo que usted registró en su proyecto y lo que dice la convocatoria. Lo que falte lo marca como [COMPLETAR: …] y se lo listamos para que lo complete antes de presentar.",
    },
    {
      pregunta: "¿Puedo cambiar de plan?",
      respuesta:
        "Sí, cuando quiera. Si su plan de pago vence, la cuenta vuelve a Gratis y no se borra nada: sus proyectos, documentos, postulaciones y encargos siguen ahí, y las funciones de pago vuelven al renovar.",
    },
    {
      pregunta: "¿Cómo se paga durante el piloto?",
      respuesta:
        "Durante el piloto no hay pasarela de pago: el pago se acuerda con nuestro equipo y nosotros activamos su plan. En la plataforma no se hace ningún cobro.",
    },
    {
      pregunta: "¿Ustedes radican la postulación por mí?",
      respuesta:
        "No. La postulación se presenta en el portal oficial de la entidad convocante. Aquí la preparamos: encontramos la convocatoria, evaluamos la compatibilidad, generamos el documento base y organizamos el checklist y el seguimiento.",
    },
  ];
}

const PUERTAS = [
  {
    puerta: "empresa",
    titulo: "Soy empresa o entidad",
    texto: "Encuentre convocatorias, prepare su postulación y trabaje con consultores. Empiece gratis, sin vencimiento.",
    icono: Building2,
  },
  {
    puerta: "consultor",
    titulo: "Soy consultor",
    texto: "Publique su perfil y reciba encargos de empresas que preparan sus postulaciones.",
    icono: HardHat,
  },
] as const;

async function planesDeEmpresa(): Promise<Plan[] | null> {
  try {
    return await listarPlanesDelRol("empresa");
  } catch (e) {
    // Las interrupciones de Next (render dinámico) no son errores: se dejan pasar.
    unstable_rethrow(e);
    console.error("Portada: no se pudieron leer los planes", e);
    return null;
  }
}

async function tarifasPublicas(): Promise<TarifasIA> {
  try {
    return await leerTarifas();
  } catch (e) {
    unstable_rethrow(e);
    return TARIFAS_POR_DEFECTO;
  }
}

const titular = "font-display text-[28px] font-bold leading-[1.15] tracking-[-0.015em] text-ink sm:text-4xl";
const antetitulo = "text-xs font-semibold uppercase tracking-[.1em] text-pri-text";

export default async function LandingPage() {
  // RF-44: cifras reales, calculadas en el servidor con caché de 1 hora. Si no
  // se pueden calcular, no se muestran: una cifra inventada es peor que ninguna.
  const [conSesion, indicadores, planes, tarifas] = await Promise.all([
    haySesion(),
    obtenerIndicadores(),
    planesDeEmpresa(),
    tarifasPublicas(),
  ]);
  const listaPlanes = planes ?? [];

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-30 border-b border-line-2 bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav aria-label="Secciones" className="hidden items-center gap-6 text-sm font-medium text-ink-2 lg:flex">
            <a href="#beneficios" className="hover:text-ink">Beneficios</a>
            <a href="#como-funciona" className="hover:text-ink">Cómo funciona</a>
            <a href="#planes" className="hover:text-ink">Planes</a>
            <a href="#preguntas" className="hover:text-ink">Preguntas</a>
          </nav>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            {conSesion ? (
              // RF-84: /login lleva a cada cuenta al portal de su rol (y al administrador sin MFA, a /mfa).
              <LinkButton href="/login" variant="primary" size="sm" className="whitespace-nowrap">
                Ir a mi portal <ArrowRight className="h-4 w-4" />
              </LinkButton>
            ) : (
              <>
                <span className="hidden sm:block">
                  <LinkButton href="/login" variant="ghost" size="sm" className="whitespace-nowrap">
                    Iniciar sesión
                  </LinkButton>
                </span>
                <LinkButton href="/registro?puerta=empresa" variant="primary" size="sm" className="whitespace-nowrap">
                  Empiece gratis
                </LinkButton>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* 1 · Portada */}
        <section className="border-b border-line-2 bg-pri-soft/50">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:py-24">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber/10 px-3 py-1 text-xs font-semibold text-amber-ink ring-1 ring-amber/30">
                Para empresas y entidades colombianas
              </span>
              <h1 className="mt-5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.02em] text-ink sm:text-5xl">
                Encuentre la financiación para su empresa y llegue a la convocatoria con el documento listo.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-[1.55] text-ink-2">
                Convocatorias verificadas por nuestro equipo con su término de referencia oficial, un cruce de compatibilidad
                que le dice cuáles le aplican y una IA que redacta el documento base sin inventar datos: lo que falte, se lo
                marcamos.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <LinkButton href="/registro?puerta=empresa" variant="primary" size="lg">
                  Empiece gratis <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="#planes" variant="outline" size="lg">
                  Ver planes
                </LinkButton>
              </div>
              <p className="mt-3 text-sm text-ink-3">Plan Gratis sin vencimiento. Sin tarjeta de crédito.</p>

              {indicadores && (
                <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6 sm:grid-cols-4">
                  <div className="flex flex-col-reverse">
                    <dt className="text-xs text-ink-3">Convocatorias vigentes</dt>
                    <dd><ContadorAnimado valor={indicadores.convocatoriasVigentes} /></dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt className="text-xs text-ink-3">Monto total disponible</dt>
                    <dd><ContadorAnimado valor={indicadores.montoDisponible} variante="cop-corto" /></dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt className="text-xs text-ink-3">Entidades convocantes</dt>
                    <dd><ContadorAnimado valor={indicadores.entidades} /></dd>
                  </div>
                  <div className="flex flex-col-reverse">
                    <dt className="text-xs text-ink-3">Consultores aprobados</dt>
                    <dd><ContadorAnimado valor={indicadores.consultoresAprobados} /></dd>
                  </div>
                </dl>
              )}
            </div>

            {/* RF-84: las dos puertas. Ninguna convocatoria individual a la vista sin cuenta de empresa (RN-33). */}
            <div className="min-w-0 space-y-4">
              {PUERTAS.map(({ puerta, titulo, texto, icono: Icono }) => (
                <div key={puerta} className="rounded-md border border-line bg-surface p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-pri text-on-pri">
                      <Icono className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                    </span>
                    <h2 className="font-display text-lg font-bold text-ink">{titulo}</h2>
                  </div>
                  <p className="mt-3 text-sm text-ink-2">{texto}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <LinkButton href={`/registro?puerta=${puerta}`} variant="primary">
                      Crear cuenta <ArrowRight className="h-4 w-4" />
                    </LinkButton>
                    <Link href={`/login?puerta=${puerta}`} className="text-sm font-semibold text-pri-text hover:underline">
                      Ya tengo cuenta
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2 · El problema */}
        <section aria-labelledby="titulo-problema" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <p className={antetitulo}>El problema</p>
          <h2 id="titulo-problema" className={`mt-2 max-w-3xl ${titular}`}>
            Conseguir financiación no debería ser un segundo trabajo
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PROBLEMAS.map(({ icono: Icono, titulo, texto }) => (
              <div key={titulo} className="rounded-md border border-line-2 bg-surface p-6">
                <Icono className="h-6 w-6 text-rose" strokeWidth={1.75} aria-hidden />
                <h3 className="mt-4 font-display text-lg font-semibold text-ink">{titulo}</h3>
                <p className="mt-2 text-sm leading-[1.6] text-ink-2">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3 · Beneficios */}
        <section id="beneficios" aria-labelledby="titulo-beneficios" className="scroll-mt-20 border-y border-line-2 bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className={antetitulo}>Beneficios</p>
            <h2 id="titulo-beneficios" className={`mt-2 max-w-3xl ${titular}`}>
              Menos tiempo buscando, más tiempo preparando una postulación sólida
            </h2>
            <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFICIOS.map(({ icono: Icono, titulo, texto, funcion }) => {
                const plan = funcion ? planQueIncluye(funcion, listaPlanes) : null;
                return (
                  <div key={titulo} className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-pri-soft text-pri-text">
                        <Icono className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                      </span>
                      {plan && (
                        <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-semibold text-ink-2 ring-1 ring-line">
                          {/esencial/i.test(plan.nombre) ? "Desde" : "Plan"} {nombreCortoPlan(plan.nombre)}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-ink">{titulo}</h3>
                    <p className="mt-2 text-sm leading-[1.6] text-ink-2">{texto}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4 · Cómo funciona */}
        <section id="como-funciona" aria-labelledby="titulo-pasos" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
          <p className={antetitulo}>Cómo funciona</p>
          <h2 id="titulo-pasos" className={`mt-2 max-w-3xl ${titular}`}>
            De la idea a la postulación en cuatro pasos
          </h2>
          <ol className="mt-10 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            {PASOS.map(({ titulo, texto }, i) => (
              <li key={titulo} className="min-w-0 rounded-md border border-line-2 bg-surface p-6">
                <span className="font-tabular grid h-9 w-9 place-items-center rounded-full bg-pri text-sm font-semibold text-on-pri">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-base font-semibold text-ink">{titulo}</h3>
                <p className="mt-2 text-sm leading-[1.6] text-ink-2">{texto}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 5 · Qué hacemos y qué no (RN-19) */}
        <section aria-labelledby="titulo-alcance" className="border-y border-line-2 bg-surface">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <p className={antetitulo}>Con claridad</p>
            <h2 id="titulo-alcance" className={`mt-2 max-w-3xl ${titular}`}>
              Aquí se prepara la postulación; se radica en el portal oficial
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <div className="rounded-md border border-line bg-bg p-6">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <ClipboardCheck className="h-5 w-5 text-pri-text" aria-hidden /> Lo que hacemos
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-ink-2">
                  {HACEMOS.map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-pri-text" aria-hidden />
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-md border border-line bg-bg p-6">
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-ink">
                  <FileText className="h-5 w-5 text-ink-3" aria-hidden /> Lo que no hacemos
                </h3>
                <ul className="mt-4 space-y-3 text-sm text-ink-2">
                  {NO_HACEMOS.map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 6 · Planes (RF-82): leídos de la base */}
        <section id="planes" aria-labelledby="titulo-planes" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
          <div className="text-center">
            <p className={antetitulo}>Planes</p>
            <h2 id="titulo-planes" className={`mx-auto mt-2 max-w-3xl ${titular}`}>
              Empiece gratis y mejore cuando lo necesite
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-ink-2">
              Todos los planes incluyen el catálogo verificado, las guardadas y sus proyectos sin límite. Si un plan de pago
              vence, vuelve a Gratis sin perder nada.
            </p>
          </div>
          <div className="mt-10">
            {listaPlanes.length > 0 ? (
              <PlanesPortada planes={listaPlanes} tarifaDocumento={tarifas.generacion} />
            ) : (
              <p className="text-center text-sm text-ink-3">No pudimos cargar los planes en este momento. Intente de nuevo más tarde.</p>
            )}
          </div>
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-ink-3">
            Durante el piloto, el pago de los planes se acuerda con nuestro equipo y nosotros los activamos: en la plataforma
            no se hace ningún cobro. Precios en pesos colombianos.
          </p>
        </section>

        {/* 7 · Para consultores (la segunda puerta, RF-84) */}
        <section aria-labelledby="titulo-consultores" className="border-y border-line-2 bg-pri-soft/50">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div className="min-w-0 max-w-2xl">
              <p className={antetitulo}>Para consultores</p>
              <h2 id="titulo-consultores" className="mt-2 font-display text-2xl font-bold text-ink sm:text-3xl">
                ¿Formula proyectos? Encuentre empresas que lo necesitan
              </h2>
              <p className="mt-3 text-ink-2">
                Publique su perfil con su experiencia y reciba encargos de empresas que preparan sus postulaciones. Nuestro equipo
                revisa cada perfil antes de que aparezca en el directorio, y el pago del servicio lo acuerda directamente con la
                empresa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <LinkButton href="/registro?puerta=consultor" variant="primary" size="lg">
                <UserPlus className="h-4 w-4" /> Crear cuenta de consultor
              </LinkButton>
              <Link href="/login?puerta=consultor" className="text-sm font-semibold text-pri-text hover:underline">
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* 8 · Preguntas frecuentes */}
        <section id="preguntas" aria-labelledby="titulo-preguntas" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 lg:px-8">
          <p className={`text-center ${antetitulo}`}>Preguntas frecuentes</p>
          <h2 id="titulo-preguntas" className={`mt-2 text-center ${titular}`}>
            Lo que suelen preguntarnos
          </h2>
          <div className="mt-10 divide-y divide-line rounded-md border border-line bg-surface">
            {preguntas(tarifas, listaPlanes).map(({ pregunta, respuesta }) => (
              <details key={pregunta} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  <span className="min-w-0">{pregunta}</span>
                  <span aria-hidden className="text-xl leading-none text-ink-3 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-[1.65] text-ink-2">{respuesta}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 9 · Cierre */}
        <section className="border-t border-line-2 bg-pri">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6 lg:px-8">
            <h2 className="max-w-3xl font-display text-[26px] font-bold leading-[1.2] text-on-pri sm:text-3xl">
              Su próxima fuente de financiación puede estar abierta hoy.
            </h2>
            <LinkButton href="/registro?puerta=empresa" variant="secondary" size="lg">
              Empiece gratis <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-2 py-6 text-center text-xs text-ink-3">
        FundRadar · Las cifras del catálogo se calculan en vivo. La postulación se presenta en el portal de cada entidad.
      </footer>
    </div>
  );
}
