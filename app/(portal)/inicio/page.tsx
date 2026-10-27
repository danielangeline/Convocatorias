import Link from "next/link";
import { ArrowRight, Banknote, FolderPlus, Send, Target } from "lucide-react";
import { obtenerSesion } from "@/lib/auth";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { listarPostulaciones } from "@/lib/postulaciones-servidor";
import { sugerenciasDeProyecto, type Sugerencia } from "@/lib/sugerencias";
import { ESTADO_POSTULACION_LABEL, diasRestantes, formatRangoCOP } from "@/lib/utils";
import { LinkButton } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard, KpiGrid } from "@/components/viz/KpiCard";
import { StackedBarChart, type BarraApilada } from "@/components/viz/StackedBarChart";
import { CompatRing } from "@/components/viz/CompatRing";
import { DeadlineTile } from "@/components/viz/Deadline";
import { ProgressRow } from "@/components/viz/ProgressRow";
import { KpiCreditos } from "@/components/inicio/KpiCreditos";

// CU-44, RF-101 · Inicio de la empresa. Solo presenta lo que ya existe: el
// catálogo, las sugerencias de CU-10 (cruce determinístico, RN-05), las
// postulaciones y los créditos. Se lee con la sesión de la empresa (RN-30).
const ESTADOS_ACTIVOS = ["en_preparacion", "presentada", "en_evaluacion"];
const MAXIMO_PROYECTOS = 8;

function fechaYSaludo() {
  const ahora = new Date();
  const zona = { timeZone: "America/Bogota" } as const;
  const fecha = new Intl.DateTimeFormat("es-CO", { ...zona, weekday: "long", day: "numeric", month: "long" }).format(ahora);
  const hora = Number(new Intl.DateTimeFormat("es-CO", { ...zona, hour: "numeric", hour12: false }).format(ahora));
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  return { fecha: fecha.charAt(0).toUpperCase() + fecha.slice(1), saludo };
}

function montoAbreviado(v: number): { valor: string; sufijo: string } {
  if (v >= 1e9) return { valor: (v / 1e9).toLocaleString("es-CO", { maximumFractionDigits: 1 }), sufijo: " mM" };
  return { valor: Math.round(v / 1e6).toLocaleString("es-CO"), sufijo: " M" };
}

export default async function InicioPage() {
  const [datos, proyectos, postulaciones] = await Promise.all([obtenerSesion(), listarProyectos(), listarPostulaciones()]);
  const { fecha, saludo } = fechaYSaludo();
  const nombre = datos?.sesion.nombre.split(/\s+/)[0] ?? "";

  // Mejor porcentaje de cada convocatoria entre todos los proyectos (CU-10).
  // Con la suscripción vencida el servidor responde 402 y esa parte se omite.
  const resultados = await Promise.all(proyectos.slice(0, MAXIMO_PROYECTOS).map((p) => sugerenciasDeProyecto(p.id)));
  const mejores = new Map<string, Sugerencia>();
  for (const r of resultados) {
    if (!r.ok) continue;
    for (const s of r.datos.sugerencias) {
      const actual = mejores.get(s.convocatoria.id);
      if (!actual || s.porcentaje > actual.porcentaje) mejores.set(s.convocatoria.id, s);
    }
  }
  const compatibles = [...mejores.values()].filter((s) => diasRestantes(s.convocatoria.fechaCierre) >= 0);
  const porPorcentaje = [...compatibles].sort((a, b) => b.porcentaje - a.porcentaje);
  const porCierre = [...compatibles].sort((a, b) => a.convocatoria.fechaCierre.localeCompare(b.convocatoria.fechaCierre));
  const cierranPronto = compatibles.filter((s) => diasRestantes(s.convocatoria.fechaCierre) <= 15).length;

  const activas = postulaciones.filter((p) => ESTADOS_ACTIVOS.includes(p.estado));
  const enJuego = compatibles.reduce((suma, s) => suma + (s.convocatoria.montoMax ?? 0), 0);
  const conMonto = compatibles.filter((s) => s.convocatoria.montoMax != null).length;

  // Fondos por mes de cierre (suma de montoMax de las compatibles; los nulos no suman).
  const porMes = new Map<string, number>();
  for (const s of compatibles) {
    if (s.convocatoria.montoMax == null) continue;
    const mes = s.convocatoria.fechaCierre.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + s.convocatoria.montoMax);
  }
  const barras: BarraApilada[] = [...porMes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([mes, total]) => ({
      etiqueta: new Intl.DateTimeFormat("es-CO", { month: "short", timeZone: "UTC" })
        .format(new Date(`${mes}-01T00:00:00Z`))
        .replace(".", "")
        .replace(/^./, (c) => c.toUpperCase()),
      publico: total,
      privado: 0,
    }));

  const resumen =
    compatibles.length === 0
      ? proyectos.length === 0
        ? "Registra tu primer proyecto para ver qué convocatorias te convienen."
        : "Aún no hay convocatorias vigentes que coincidan con tus proyectos."
      : cierranPronto > 0
        ? `Tienes ${cierranPronto} ${cierranPronto === 1 ? "convocatoria compatible que cierra" : "convocatorias compatibles que cierran"} en los próximos 15 días.`
        : `Tienes ${compatibles.length} ${compatibles.length === 1 ? "convocatoria compatible" : "convocatorias compatibles"} con tus proyectos.`;
  const m = montoAbreviado(enJuego);

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
          etiqueta="Compatibles"
          valor={compatibles.length}
          nota={proyectos.length === 0 ? "Registra un proyecto" : `Con ${proyectos.length} ${proyectos.length === 1 ? "proyecto" : "proyectos"}`}
          icono={Target}
        />
        <KpiCard etiqueta="Postulaciones activas" valor={activas.length} nota="En preparación, presentadas o en evaluación" icono={Send} tono="sky" />
        {conMonto > 0 && (
          <KpiCard etiqueta="Monto en juego" valor={m.valor} sufijo={m.sufijo} nota="Suma del monto máximo de las compatibles" icono={Banknote} tono="amber" />
        )}
        <KpiCreditos />
      </KpiGrid>

      {compatibles.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5">
          {barras.length > 0 && (
            <Card className="flex flex-col gap-4">
              <CardHeader titulo="Fondos disponibles para tu perfil" subtitulo="Monto máximo por mes de cierre · COP" />
              <StackedBarChart unaSerie datos={barras} etiquetaAccesible="Fondos disponibles para tu perfil por mes de cierre" />
            </Card>
          )}
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
                    {s.convocatoria.entidadConvocante} · {formatRangoCOP(s.convocatoria.montoMin, s.convocatoria.montoMax)}
                  </div>
                </div>
                <span className="font-tabular text-xs font-semibold text-pri-text">{s.porcentaje}%</span>
              </Link>
            ))}
          </Card>
        </div>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5">
        <Card className="flex flex-col gap-3.5">
          <CardHeader titulo="Sugeridas para tus proyectos" subtitulo="Cruce de tipo, sector, entidad, monto y ubicación" />
          {porPorcentaje.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              {proyectos.length === 0 ? (
                <>
                  Aún no tienes proyectos. <Link href="/proyectos" className="font-bold text-pri-text">Crea el primero</Link> y aquí verás las convocatorias que mejor le pegan.
                </>
              ) : (
                "Ninguna convocatoria vigente coincide todavía. Completa los datos de tus proyectos para mejorar el cruce."
              )}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
              {porPorcentaje.slice(0, 3).map((s) => (
                <Link
                  key={s.convocatoria.id}
                  href={`/convocatorias/${s.convocatoria.id}`}
                  className="flex flex-col gap-3 rounded-[14px] border border-line bg-bg p-3.5 hover:border-pri"
                >
                  <CompatRing porcentaje={s.porcentaje} fondo="var(--bg)" />
                  <div className="text-[13.5px] font-bold leading-snug [text-wrap:pretty]">{s.convocatoria.nombre}</div>
                  <div className="mt-auto text-xs text-ink-3">{s.convocatoria.entidadConvocante}</div>
                </Link>
              ))}
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
          {activas.length === 0 ? (
            <p className="text-[13px] text-ink-2">
              No tienes postulaciones activas. <Link href="/convocatorias" className="font-bold text-pri-text">Explora el catálogo</Link> para preparar la primera.
            </p>
          ) : (
            activas.slice(0, 4).map((p) => (
              <Link key={p.id} href={`/postulaciones/${p.id}`} className="-mx-2.5 rounded-xl p-2.5 hover:bg-surface-2">
                <ProgressRow
                  nombre={p.convocatoria?.nombre ?? "Convocatoria no disponible"}
                  etapa={ESTADO_POSTULACION_LABEL[p.estado]}
                  hechos={p.checklist.filter((i) => i.completado).length}
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
