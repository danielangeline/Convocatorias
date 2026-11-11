import Link from "next/link";
import { ArrowRight, FolderPlus } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { listarCatalogo } from "@/lib/catalogo";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { compatibilidadEmpresa, nuevasEstaSemana } from "@/lib/compatibilidad-empresa";
import { ETAPA_LABEL, etapaDe } from "@/lib/etapas-postulacion";
import { listaConY, proximoPaso } from "@/lib/proximo-paso";
import { diasRestantes } from "@/lib/utils";
import { formatRangoConvocatoria, montoMaxCop } from "@/lib/monedas";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { KpiCelda, KpiFranja } from "@/components/viz/KpiCard";
import { DeadlineTile } from "@/components/viz/Deadline";
import { ProgressRow } from "@/components/viz/ProgressRow";
import { KpiCreditos } from "@/components/inicio/KpiCreditos";

// CU-44, RF-101 · Inicio de la empresa. Solo presenta lo que ya existe: el
// catálogo (con su tipo y origen, RF-102), la compatibilidad de CU-10 (cruce
// determinístico, RN-05), las postulaciones y los créditos. Se lee con la
// sesión de la empresa (RN-30). Rediseño FundRadar: una sola acción («Tu
// próximo paso»), la franja de KPI y dos listas; la gráfica de fondos por mes salió.
const ESTADOS_ACTIVOS = ["en_preparacion", "presentada", "en_evaluacion"];

function fechaYSaludo() {
  const ahora = new Date();
  const zona = { timeZone: "America/Bogota" } as const;
  const fecha = new Intl.DateTimeFormat("es-CO", { ...zona, weekday: "long", day: "numeric", month: "long" }).format(ahora);
  const hora = Number(new Intl.DateTimeFormat("es-CO", { ...zona, hour: "numeric", hour12: false }).format(ahora));
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  return { fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), saludo };
}

const millones = (v: number) => `$${Math.round(v / 1e6).toLocaleString("es-CO")}`;
/** Monto corto para las listas: «$80 M», «Hasta $2.000 M», «Monto no informado». */
function montoCorto(min: number | null, max: number | null): string {
  if (max == null && min == null) return "Monto no informado";
  if (max != null && (min == null || min === max)) return `Hasta ${millones(max)} M`;
  if (max == null) return `Desde ${millones(min!)} M`;
  return `${millones(min!)} – ${millones(max)} M`;
}
const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
    .replace(".", "");

export default async function InicioPage() {
  const [datos, postulaciones, catalogo, compat] = await Promise.all([
    obtenerSesion(),
    listarPostulaciones(),
    listarCatalogo(),
    compatibilidadEmpresa(),
  ]);
  const { fecha, saludo } = fechaYSaludo();
  const nombre = datos?.sesion.nombre.split(/\s+/)[0] ?? "";
  const proyectos = compat.proyectos;

  const compatibles = [...compat.porConvocatoria.values()];
  const porCierre = [...compatibles].sort((a, b) => a.convocatoria.fechaCierre.localeCompare(b.convocatoria.fechaCierre));
  const cierranPronto = compatibles.filter((s) => diasRestantes(s.convocatoria.fechaCierre) <= 15).length;
  const nuevas = nuevasEstaSemana(compatibles, catalogo);

  const activas = postulaciones.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
  const conEtapa = activas.map((p) => {
    const hechos = p.checklist.filter((i) => i.completado).length;
    return { p, hechos, etapa: etapaDe(p.estado, hechos, p.checklist.length) };
  });
  const listas = conEtapa.filter((x) => x.etapa === "lista").length;
  // En pesos (RN-40): un monto en otra moneda sin tasa no suma.
  const conMonto = activas.filter((p) => p.convocatoria && montoMaxCop(p.convocatoria) != null);
  const enJuego = conMonto.reduce((suma, p) => suma + (montoMaxCop(p.convocatoria!) ?? 0), 0);

  const paso = proximoPaso(postulaciones, proyectos, compatibles.length);

  const resumen =
    compatibles.length === 0 ? (
      proyectos === 0 ? (
        "Registra tu primer proyecto para ver qué convocatorias te convienen."
      ) : (
        "Aún no hay convocatorias vigentes que coincidan con tus proyectos."
      )
    ) : cierranPronto > 0 ? (
      <>
        Tienes{" "}
        <strong className="text-ink">
          {cierranPronto} {cierranPronto === 1 ? "convocatoria compatible" : "convocatorias compatibles"}
        </strong>{" "}
        que {cierranPronto === 1 ? "cierra" : "cierran"} en los próximos 15 días.
      </>
    ) : (
      <>
        Tienes <strong className="text-ink">{compatibles.length} convocatorias compatibles</strong> con tus proyectos.
      </>
    );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={fecha}
        titulo={`${saludo}${nombre ? `, ${nombre}` : ""}`}
        descripcion={resumen}
        accion={
          <>
            <LinkButton href="/proyectos" variant="secondary">
              <FolderPlus className="h-4 w-4" /> Nuevo proyecto
            </LinkButton>
            <LinkButton href="/convocatorias">
              Explorar convocatorias <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </>
        }
      />

      {/* Tu próximo paso: una sola acción, la más útil ahora. */}
      {paso && (
        <section
          aria-labelledby="proximo-paso"
          data-recorrido="proximo-paso"
          className="flex flex-wrap items-center justify-between gap-5 rounded-md bg-pri-soft p-5 sm:p-6"
        >
          <div className="min-w-0 flex-[1_1_360px]">
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[.08em] text-pri-text">
              <span aria-hidden className="relative h-2 w-2 flex-none">
                <span className="ping-ring absolute inset-0 rounded-full bg-amber" />
                <span className="absolute inset-0 rounded-full bg-amber" />
              </span>
              Tu próximo paso
            </p>
            {paso.tipo === "completar_postulacion" && (
              <>
                <h2 id="proximo-paso" className="mt-2 font-display text-2xl font-semibold leading-tight text-ink">
                  Completa la postulación a {paso.convocatoria}
                </h2>
                <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-2 [text-wrap:pretty]">
                  Te faltan {paso.pendientes} de {paso.total} requisitos: {listaConY(paso.nombresPendientes)}
                  {paso.pendientes > paso.nombresPendientes.length ? " y otros" : ""}.
                </p>
                <ProgressBar
                  porcentaje={((paso.total - paso.pendientes) / paso.total) * 100}
                  className="mt-3.5 max-w-md"
                />
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <LinkButton href={`/postulaciones/${paso.postulacionId}`}>Continuar postulación</LinkButton>
                  <LinkButton href={`/convocatorias/${paso.convocatoriaId}`} variant="outline">
                    Ver la convocatoria
                  </LinkButton>
                </div>
              </>
            )}
            {paso.tipo === "registrar_proyecto" && (
              <>
                <h2 id="proximo-paso" className="mt-2 font-display text-2xl font-semibold leading-tight text-ink">
                  Registra tu primer proyecto
                </h2>
                <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-2">
                  Con un proyecto registrado cruzamos sus datos con el catálogo y te mostramos las convocatorias que
                  mejor le pegan.
                </p>
                <div className="mt-4">
                  <LinkButton href="/proyectos">Registrar proyecto</LinkButton>
                </div>
              </>
            )}
            {paso.tipo === "revisar_sugeridas" && (
              <>
                <h2 id="proximo-paso" className="mt-2 font-display text-2xl font-semibold leading-tight text-ink">
                  Revisa tus {paso.cantidad} {paso.cantidad === 1 ? "sugerida" : "sugeridas"}
                </h2>
                <p className="mt-1.5 text-[15px] leading-[1.55] text-ink-2">
                  Son las convocatorias vigentes que mejor coinciden con tus proyectos, de mayor a menor compatibilidad.
                </p>
                <div className="mt-4">
                  <LinkButton href="/convocatorias?tab=sugeridas">Ver sugeridas</LinkButton>
                </div>
              </>
            )}
          </div>
          {paso.tipo === "completar_postulacion" && (
            <div
              className="flex min-w-[120px] flex-col items-center rounded-md bg-surface px-5 py-4 text-center"
              aria-label={`Cierra en ${paso.dias} días`}
            >
              <span className={`font-tabular text-[44px] font-medium leading-none ${paso.dias < 10 ? "text-rose" : "text-ink"}`}>
                {paso.dias}
              </span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-[.08em] text-ink-3">
                {paso.dias === 1 ? "día" : "días"}
              </span>
              <span className="mt-1 text-xs text-ink-3">Cierra el {fechaCorta(paso.fechaCierre)}</span>
            </div>
          )}
        </section>
      )}

      <KpiFranja>
        <KpiCelda
          etiqueta="Compatibles contigo"
          valor={compatibles.length}
          nota={
            proyectos === 0
              ? "Registra un proyecto"
              : nuevas > 0
                ? `+${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"} esta semana`
                : `Con ${proyectos} ${proyectos === 1 ? "proyecto" : "proyectos"}`
          }
          href="/convocatorias?tab=sugeridas"
        />
        <KpiCelda
          etiqueta="Postulaciones activas"
          valor={activas.length}
          nota={listas > 0 ? `${listas} ${listas === 1 ? "lista" : "listas"} para radicar` : "En preparación o radicadas"}
          href="/postulaciones"
        />
        <KpiCelda
          etiqueta="Monto en juego"
          valor={millones(enJuego)}
          sufijo=" M"
          nota={conMonto.length > 0 ? `COP en ${conMonto.length} ${conMonto.length === 1 ? "postulación" : "postulaciones"}` : "Sin montos informados"}
          href="/postulaciones"
        />
        <KpiCreditos />
      </KpiFranja>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
        <Card className="flex flex-col gap-1.5">
          <CardHeader
            className="mb-2"
            titulo="Próximos cierres"
            accion={
              <Link href="/convocatorias" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-pri-text hover:underline">
                Ver todas
              </Link>
            }
          />
          {porCierre.length === 0 && (
            <p className="text-[13px] text-ink-2">No hay convocatorias compatibles por cerrar.</p>
          )}
          {porCierre.slice(0, 4).map((s) => (
            <Link
              key={s.convocatoria.id}
              href={`/convocatorias/${s.convocatoria.id}`}
              className="-mx-2.5 flex items-center gap-3.5 rounded-[4px] p-2.5 hover:bg-surface-2"
            >
              <DeadlineTile dias={diasRestantes(s.convocatoria.fechaCierre)} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[17px] font-semibold leading-snug">{s.convocatoria.nombre}</div>
                <div className="mt-0.5 truncate text-xs text-ink-3">
                  {s.convocatoria.entidadConvocante} ·{" "}
                  {(s.convocatoria.moneda ?? "COP") === "COP"
                    ? montoCorto(s.convocatoria.montoMin, s.convocatoria.montoMax)
                    : formatRangoConvocatoria(s.convocatoria)}
                </div>
              </div>
              <span className="font-tabular text-xs font-medium text-pri-text">{s.porcentaje}%</span>
            </Link>
          ))}
        </Card>

        <Card className="flex flex-col gap-3.5">
          <CardHeader
            titulo="Mis postulaciones"
            accion={
              <Link href="/postulaciones" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-pri-text hover:underline">
                Abrir tablero
              </Link>
            }
          />
          {conEtapa.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              No tienes postulaciones activas.{" "}
              <Link href="/convocatorias" className="font-semibold text-pri-text hover:underline">
                Explora el catálogo
              </Link>{" "}
              para preparar la primera.
            </p>
          ) : (
            conEtapa.slice(0, 4).map(({ p, hechos, etapa }) => (
              <Link key={p.id} href={`/postulaciones/${p.id}`} className="-mx-2.5 rounded-[4px] p-2.5 hover:bg-surface-2">
                <ProgressRow
                  nombre={p.convocatoria?.nombre ?? "Convocatoria no disponible"}
                  etapa={ETAPA_LABEL[etapa]}
                  hechos={hechos}
                  total={p.checklist.length}
                  dias={p.convocatoria ? Math.max(0, diasRestantes(p.convocatoria.fechaCierre)) : undefined}
                />
              </Link>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
