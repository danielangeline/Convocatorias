import Link from "next/link";
import { ArrowRight, Banknote, FolderPlus, KanbanSquare, Target } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { listarCatalogo } from "@/lib/catalogo";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { compatibilidadEmpresa, nuevasEstaSemana } from "@/lib/compatibilidad-empresa";
import { ETAPA_LABEL, etapaDe } from "@/lib/etapas-postulacion";
import { diasRestantes } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { KpiCard, KpiGrid } from "@/components/viz/KpiCard";
import { StackedBarChart, type BarraApilada } from "@/components/viz/StackedBarChart";
import { CompatRing } from "@/components/viz/CompatRing";
import { DeadlineTile } from "@/components/viz/Deadline";
import { ProgressRow } from "@/components/viz/ProgressRow";
import { KpiCreditos } from "@/components/inicio/KpiCreditos";

// CU-44, RF-101 · Inicio de la empresa. Solo presenta lo que ya existe: el
// catálogo (con su tipo y origen, RF-102), la compatibilidad de CU-10 (cruce
// determinístico, RN-05), las postulaciones y los créditos. Se lee con la
// sesión de la empresa (RN-30).
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
const milesDeMillones = (v: number) => `$${(v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 })}`;
/** Monto corto para las listas: «$80 M», «Hasta $2.000 M», «Monto no informado». */
function montoCorto(min: number | null, max: number | null): string {
  if (max == null && min == null) return "Monto no informado";
  if (max != null && (min == null || min === max)) return `Hasta ${millones(max)} M`;
  if (max == null) return `Desde ${millones(min!)} M`;
  return `${millones(min!)} – ${millones(max)} M`;
}

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
  const porPorcentaje = [...compatibles].sort((a, b) => b.porcentaje - a.porcentaje);
  const porCierre = [...compatibles].sort((a, b) => a.convocatoria.fechaCierre.localeCompare(b.convocatoria.fechaCierre));
  const cierranPronto = compatibles.filter((s) => diasRestantes(s.convocatoria.fechaCierre) <= 15).length;
  const nuevas = nuevasEstaSemana(compatibles, catalogo);

  const activas = postulaciones.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
  const conEtapa = activas.map((p) => {
    const hechos = p.checklist.filter((i) => i.completado).length;
    return { p, hechos, etapa: etapaDe(p.estado, hechos, p.checklist.length) };
  });
  const listas = conEtapa.filter((x) => x.etapa === "lista").length;
  const conMonto = activas.filter((p) => p.convocatoria?.montoMax != null);
  const enJuego = conMonto.reduce((suma, p) => suma + (p.convocatoria!.montoMax ?? 0), 0);

  // Fondos por mes de cierre: suma del monto máximo de las compatibles,
  // pública abajo y privada o de cooperación arriba (RF-102). Los nulos no suman.
  const porMes = new Map<string, { publico: number; privado: number }>();
  for (const s of compatibles) {
    const c = s.convocatoria;
    if (c.montoMax == null) continue;
    const mes = c.fechaCierre.slice(0, 7);
    const acc = porMes.get(mes) ?? { publico: 0, privado: 0 };
    if ((c.origen ?? "publico") === "publico") acc.publico += c.montoMax;
    else acc.privado += c.montoMax;
    porMes.set(mes, acc);
  }
  const barras: BarraApilada[] = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([mes, v]) => ({
      etiqueta: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" })
        .format(new Date(`${mes}-01T00:00:00Z`))
        .replace(".", "")
        .replace(/^./, (c) => c.toUpperCase()),
      ...v,
    }));

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
    <div className="flex flex-col gap-5">
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

      <KpiGrid>
        <KpiCard
          etiqueta="Compatibles contigo"
          valor={compatibles.length}
          nota={
            proyectos === 0
              ? "Registra un proyecto"
              : nuevas > 0
                ? `+${nuevas} ${nuevas === 1 ? "nueva" : "nuevas"} esta semana`
                : `Con ${proyectos} ${proyectos === 1 ? "proyecto" : "proyectos"}`
          }
          icono={Target}
        />
        <KpiCard
          etiqueta="Postulaciones activas"
          valor={activas.length}
          nota={listas > 0 ? `${listas} ${listas === 1 ? "lista" : "listas"} para radicar` : "En preparación o radicadas"}
          icono={KanbanSquare}
          tono="sky"
        />
        <KpiCard
          etiqueta="Monto en juego"
          valor={millones(enJuego)}
          sufijo=" M"
          nota={conMonto.length > 0 ? `COP en ${conMonto.length} ${conMonto.length === 1 ? "postulación" : "postulaciones"}` : "Sin montos informados"}
          icono={Banknote}
          tono="amber"
        />
        <KpiCreditos />
      </KpiGrid>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5">
        <Card className="flex flex-col gap-4">
          <CardHeader
            titulo="Fondos disponibles para tu perfil"
            subtitulo="Monto total por mes de cierre · miles de millones COP"
          />
          {barras.length > 0 ? (
            <StackedBarChart
              datos={barras}
              etiquetaPrivado="Privados"
              formatear={milesDeMillones}
              etiquetaAccesible="Fondos disponibles para tu perfil por mes de cierre, públicos y privados"
            />
          ) : (
            <p className="py-10 text-center text-[13px] text-ink-3">
              Cuando haya convocatorias compatibles con monto informado, verás aquí cuánto cierra cada mes.
            </p>
          )}
        </Card>
        <Card className="flex flex-col gap-1.5">
          <CardHeader
            className="mb-2"
            titulo="Próximos cierres"
            accion={
              <Link href="/convocatorias" className="text-[12.5px] font-bold text-pri-text">
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
              className="-mx-2.5 flex items-center gap-3.5 rounded-xl p-2.5 hover:bg-surface-2"
            >
              <DeadlineTile dias={diasRestantes(s.convocatoria.fechaCierre)} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-bold">{s.convocatoria.nombre}</div>
                <div className="mt-0.5 truncate text-xs text-ink-3">
                  {s.convocatoria.entidadConvocante} · {montoCorto(s.convocatoria.montoMin, s.convocatoria.montoMax)}
                </div>
              </div>
              <span className="font-tabular text-xs font-semibold text-pri-text">{s.porcentaje}%</span>
            </Link>
          ))}
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5">
        <Card className="flex flex-col gap-3.5">
          <CardHeader
            titulo="Sugeridas para tus proyectos"
            subtitulo="Cruce de sector, tipo de entidad, ubicación y monto"
            accion={
              porPorcentaje.length > 3 ? (
                <Link href="/sugeridas" className="text-[12.5px] font-bold text-pri-text">
                  Ver todas
                </Link>
              ) : undefined
            }
          />
          {porPorcentaje.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              {proyectos === 0 ? (
                <>
                  Aún no tienes proyectos.{" "}
                  <Link href="/proyectos" className="font-bold text-pri-text">
                    Crea el primero
                  </Link>{" "}
                  y aquí verás las convocatorias que mejor le pegan.
                </>
              ) : (
                "Ninguna convocatoria vigente coincide todavía. Completa los datos de tus proyectos para mejorar el cruce."
              )}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
              {porPorcentaje.slice(0, 3).map((s) => {
                const tributario = s.convocatoria.tipo === "beneficio_tributario";
                return (
                  <Link
                    key={s.convocatoria.id}
                    href={`/convocatorias/${s.convocatoria.id}`}
                    className="flex flex-col gap-3 rounded-[14px] border border-line bg-bg p-3.5 hover:border-pri"
                  >
                    <div className="flex items-center justify-between">
                      <CompatRing porcentaje={s.porcentaje} fondo="var(--bg)" />
                      <Badge tono={tributario ? "violet" : "pri"}>{tributario ? "Tributario" : "Fondos"}</Badge>
                    </div>
                    <div className="text-[13.5px] font-bold leading-snug [text-wrap:pretty]">{s.convocatoria.nombre}</div>
                    <div className="mt-auto text-xs text-ink-3">{s.convocatoria.entidadConvocante}</div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-3.5">
          <CardHeader
            titulo="Mis postulaciones"
            accion={
              <Link href="/postulaciones" className="text-[12.5px] font-bold text-pri-text">
                Abrir tablero
              </Link>
            }
          />
          {conEtapa.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              No tienes postulaciones activas.{" "}
              <Link href="/convocatorias" className="font-bold text-pri-text">
                Explora el catálogo
              </Link>{" "}
              para preparar la primera.
            </p>
          ) : (
            conEtapa.slice(0, 4).map(({ p, hechos, etapa }) => (
              <Link key={p.id} href={`/postulaciones/${p.id}`} className="-mx-2.5 rounded-xl p-2.5 hover:bg-surface-2">
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
