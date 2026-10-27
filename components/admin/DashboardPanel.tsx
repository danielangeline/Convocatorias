import Link from "next/link";
import { ClipboardList, Clock, CreditCard, FilePen, Files } from "lucide-react";
import type { DatosTablero } from "@/lib/admin/tablero";
import { Card, CardHeader } from "@/components/ui/Card";
import { KpiCard, KpiGrid } from "@/components/viz/KpiCard";
import { WeeklyBars } from "@/components/viz/WeeklyBars";
import { SegmentedBar } from "@/components/viz/SegmentedBar";
import { MiniStatGrid } from "@/components/viz/MiniStatGrid";
import { TONO_CLASE } from "@/components/viz/tonos";
import { PerfilesEnRevision } from "./PerfilesEnRevision";

const fechaCorta = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

/**
 * Dashboard del panel (RF-42, RF-34, RF-90, RF-108): todo sale de
 * `datosTablero()`, leído en el servidor con la sesión del administrador.
 */
export function DashboardPanel({ datos, solicitudesEquipo }: { datos: DatosTablero; solicitudesEquipo: number }) {
  const s = datos.suscripciones;
  const totalSemanas = datos.semanas.reduce((t, x) => t + x.total, 0);
  const variacion =
    datos.totalTrimestreAnterior > 0
      ? Math.round(((totalSemanas - datos.totalTrimestreAnterior) / datos.totalTrimestreAnterior) * 100)
      : null;
  const mes = new Intl.DateTimeFormat("es-CO", { month: "long", timeZone: "America/Bogota" }).format(new Date());
  const medio = datos.semanas[Math.floor(datos.semanas.length / 2)];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Panel general</h1>
      {solicitudesEquipo > 0 && (
        <Link
          href="/admin/encargos"
          className={`flex items-center gap-2 self-start rounded-xl px-3.5 py-2 text-[13px] font-bold ${TONO_CLASE.rose}`}
        >
          <ClipboardList className="h-4 w-4" />
          {solicitudesEquipo} {solicitudesEquipo === 1 ? "solicitud espera" : "solicitudes esperan"} al equipo
        </Link>
      )}

      <KpiGrid>
        <KpiCard
          etiqueta="Publicadas"
          valor={datos.publicadas}
          nota={datos.publicadasEsteMes > 0 ? `+${datos.publicadasEsteMes} este mes` : "Vigentes en el catálogo"}
          icono={Files}
        />
        <KpiCard
          etiqueta="Borradores"
          valor={datos.borradores}
          nota={
            datos.borradoresSinDocumentos > 0
              ? `${datos.borradoresSinDocumentos} sin documentos adjuntos`
              : "Todos con documentos"
          }
          icono={FilePen}
          tono="sky"
        />
        <KpiCard etiqueta="Cierran en < 15 días" valor={datos.cierranPronto.length} nota="Revisa vigencias" icono={Clock} tono="amber" />
        <KpiCard
          etiqueta="Suscripciones activas"
          valor={s.activas}
          nota={datos.conversion !== null ? `Conversión de prueba: ${datos.conversion}%` : "Sin cuentas todavía"}
          icono={CreditCard}
          tono="violet"
        />
      </KpiGrid>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5">
        <Card className="flex flex-col gap-4">
          <CardHeader titulo="Postulaciones iniciadas" subtitulo={`Últimas ${datos.semanas.length} semanas`} />
          <WeeklyBars
            semanas={datos.semanas.map((w) => ({ etiqueta: `Semana del ${fechaCorta(w.inicio)}`, valor: w.total }))}
            variacion={variacion !== null ? `${variacion >= 0 ? "+" : ""}${variacion}% vs. trimestre anterior` : undefined}
            fechasReferencia={[fechaCorta(datos.semanas[0].inicio), fechaCorta(medio.inicio), fechaCorta(datos.semanas.at(-1)!.inicio)]}
            etiquetaAccesible={`Postulaciones iniciadas por semana: ${totalSemanas} en ${datos.semanas.length} semanas`}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <CardHeader
            titulo="Suscripciones por estado"
            accion={
              <Link href="/admin/suscripciones" className="text-[12.5px] font-bold text-pri-text">
                Ver todas
              </Link>
            }
          />
          <SegmentedBar
            etiquetaAccesible="Suscripciones por estado"
            segmentos={[
              { etiqueta: "Activa", valor: s.activas, tono: "pri" },
              { etiqueta: "Prueba", valor: s.trial, tono: "sky" },
              { etiqueta: "En gracia", valor: s.enGracia, tono: "amber" },
              { etiqueta: "Vencida", valor: s.vencidas, tono: "rose" },
              { etiqueta: "Suspendida", valor: s.suspendidas, tono: "neutro" },
            ]}
          />
        </Card>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
        <PerfilesEnRevision perfiles={datos.perfilesEnRevision} />

        <Card className="flex flex-col gap-1">
          <CardHeader className="mb-2" titulo="Cierran en menos de 15 días" />
          {datos.cierranPronto.length === 0 ? (
            <p className="text-[13px] text-ink-3">Ninguna convocatoria publicada cierra en los próximos 15 días.</p>
          ) : (
            datos.cierranPronto.slice(0, 5).map((c) => (
              <Link
                key={c.id}
                href={`/admin/convocatorias/${c.id}`}
                className="-mx-2 flex items-center gap-3 border-b border-line-2 px-2 py-2.5 last:border-b-0 hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold">{c.nombre}</div>
                  <div className="truncate text-xs text-ink-3">{c.entidad}</div>
                </div>
                <span
                  className={`font-tabular rounded-md px-2 py-1 text-xs font-semibold ${TONO_CLASE[c.dias < 10 ? "rose" : "amber"]}`}
                >
                  {c.dias} d
                </span>
              </Link>
            ))
          )}
        </Card>

        <MiniStatGrid
          titulo={`Consumo de IA · ${mes}`}
          stats={[
            { etiqueta: "Generaciones", valor: s.generacionesExitosas.toLocaleString("es-CO") },
            { etiqueta: "Ajustes", valor: s.ajustes.toLocaleString("es-CO") },
            { etiqueta: "Fallidas (sin costo)", valor: s.generacionesFallidas.toLocaleString("es-CO") },
            {
              etiqueta: "Costo estimado USD",
              valor: `$${s.costoUsd.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            },
          ]}
        />
      </div>
    </div>
  );
}
