import { Briefcase, Coins, FileCheck2, Target } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { KpiCard, KpiGrid } from "./KpiCard";
import { StackedBarChart } from "./StackedBarChart";
import { WeeklyBars } from "./WeeklyBars";
import { SegmentedBar } from "./SegmentedBar";
import { CompatRing } from "./CompatRing";
import { CompatBreakdown } from "./CompatBreakdown";
import { DeadlineChip, DeadlineTile } from "./Deadline";
import { ProgressRow } from "./ProgressRow";
import { KanbanBoard } from "./KanbanBoard";
import { MiniStatGrid } from "./MiniStatGrid";
import { ChecklistSteps } from "./ChecklistSteps";
import { CreditMeter } from "./CreditMeter";

// Página interna de prueba de la fase 1 (datos de muestra, no reales). Se
// borra al cerrar el rediseño (fase 6).
export function VizMuestra() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
      <PageHeader
        titulo="Visualizaciones"
        descripcion="Muestra de cada pieza con datos de ejemplo; alterna el tema."
        accion={<ThemeToggle />}
      />
      <KpiGrid>
        <KpiCard etiqueta="Compatibles" valor={12} nota="Con tus proyectos" icono={Target} />
        <KpiCard etiqueta="Postulaciones" valor={3} icono={FileCheck2} tono="sky" />
        <KpiCard etiqueta="Monto en juego" valor="4,2" sufijo=" mM" icono={Briefcase} tono="amber" />
        <KpiCard etiqueta="Créditos de IA" valor={7} sufijo=" /10" icono={Coins} tono="violet" />
      </KpiGrid>
      <div className="grid gap-3.5 md:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader titulo="Fondos por mes de cierre" subtitulo="Públicos y privados" />
          <StackedBarChart
            etiquetaAccesible="Fondos por mes de cierre"
            datos={[
              { etiqueta: "Nov", publico: 2.1e9, privado: 0.6e9 },
              { etiqueta: "Dic", publico: 3.4e9, privado: 1.2e9 },
              { etiqueta: "Ene", publico: 0.9e9, privado: 0 },
              { etiqueta: "Feb", publico: 1.5e9, privado: 2.2e9 },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-4">
          <CardHeader titulo="Postulaciones iniciadas" />
          <WeeklyBars
            etiquetaAccesible="Postulaciones por semana"
            variacion="+18% vs. trimestre anterior"
            fechasReferencia={["Ago", "Sep", "Oct"]}
            semanas={[3, 5, 4, 7, 6, 9, 8, 6, 10, 12, 9, 14].map((v, i) => ({ etiqueta: `S${i + 1}`, valor: v }))}
          />
        </Card>
      </div>
      <div className="grid gap-3.5 md:grid-cols-3">
        <Card className="flex flex-col gap-4">
          <CardHeader titulo="Suscripciones por estado" />
          <SegmentedBar
            etiquetaAccesible="Suscripciones por estado"
            segmentos={[
              { etiqueta: "Activa", valor: 24, tono: "pri" },
              { etiqueta: "Trial", valor: 11, tono: "sky" },
              { etiqueta: "En gracia", valor: 3, tono: "amber" },
              { etiqueta: "Vencida", valor: 2, tono: "rose" },
              { etiqueta: "Suspendida", valor: 1, tono: "neutro" },
            ]}
          />
        </Card>
        <Card className="flex flex-col gap-3.5">
          <CardHeader titulo="Cierres y compatibilidad" />
          <div className="flex items-center gap-3">
            <DeadlineTile dias={8} />
            <DeadlineTile dias={13} />
            <DeadlineTile dias={30} />
            <DeadlineChip dias={9} />
          </div>
          <div className="flex items-center gap-3">
            <CompatRing porcentaje={92} />
            <CompatRing porcentaje={64} />
            <CompatRing porcentaje={87} tamano={84} />
          </div>
          <CompatBreakdown
            criterios={[
              { nombre: "Sector", estado: "coincide", resultado: "Agroindustria" },
              { nombre: "Ubicación", estado: "parcial", resultado: "Revisar" },
            ]}
          />
        </Card>
        <div className="flex flex-col gap-3.5">
          <MiniStatGrid
            titulo="Consumo de IA"
            stats={[
              { etiqueta: "Documentos", valor: 41 },
              { etiqueta: "Ajustes", valor: 96 },
              { etiqueta: "Créditos", valor: "5.200" },
              { etiqueta: "Costo USD", valor: "0,66" },
            ]}
          />
          <CreditMeter plan="Plan Pro" usados={420} total={800} nota="Se renuevan el 1 nov." />
        </div>
      </div>
      <div className="grid gap-3.5 md:grid-cols-2">
        <Card className="flex flex-col gap-3.5">
          <CardHeader titulo="Mis postulaciones" />
          <ProgressRow nombre="Fondo Emprender" etapa="En preparación" hechos={4} total={9} dias={12} />
          <ProgressRow nombre="ZASCA Honda" etapa="Presentada" hechos={6} total={6} />
        </Card>
        <Card className="flex flex-col gap-3.5">
          <CardHeader titulo="Perfil del consultor" accion={<Badge tono="pri">Aprobado</Badge>} />
          <ChecklistSteps
            pasos={[
              { etiqueta: "Foto y presentación", hecho: true },
              { etiqueta: "Portafolio", hecho: true },
              { etiqueta: "Enlaces", hecho: false },
            ]}
          />
          <div className="flex gap-2">
            <Button>Primario</Button>
            <Button variant="secondary">Secundario</Button>
            <Button variant="ai">IA</Button>
          </div>
        </Card>
      </div>
      <KanbanBoard
        columnas={[
          {
            clave: "prep",
            titulo: "En preparación",
            tono: "neutro",
            tarjetas: [
              { id: "1", entidad: "iNNpulsa", nombre: "ZASCA Norte de Santander", proyecto: "Planta solar", hechos: 3, total: 8, dias: 7, consultor: "Ana Ríos" },
            ],
          },
          { clave: "pres", titulo: "Presentada", tono: "sky", tarjetas: [] },
          {
            clave: "eval",
            titulo: "En evaluación",
            tono: "amber",
            tarjetas: [
              { id: "2", entidad: "Minciencias", nombre: "Convocatoria 53 SGR", proyecto: "Laboratorio", hechos: 8, total: 8, dias: null },
            ],
          },
          { clave: "apr", titulo: "Aprobada", tono: "pri", tarjetas: [] },
        ]}
      />
    </div>
  );
}
