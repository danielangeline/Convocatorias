import Link from "next/link";
import { FolderPlus, WandSparkles } from "lucide-react";
import { compatibilidadEmpresa } from "@/lib/compatibilidad-empresa";
import { diasRestantes } from "@/lib/utils";
import { formatRangoConvocatoria } from "@/lib/monedas";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CompatRing } from "@/components/viz/CompatRing";
import { CompatBreakdown } from "@/components/viz/CompatBreakdown";
import { DeadlineChip } from "@/components/viz/Deadline";

export const metadata = { title: "Sugeridas para ti" };

// RF-106, CU-10 · Todas las convocatorias vigentes que coinciden con algún
// proyecto de la empresa, de mayor a menor compatibilidad, con el proyecto que
// mejor coincide y el desglose por criterio. Cruce determinístico (RN-05).
export default async function SugeridasPage() {
  const { porConvocatoria, proyectos } = await compatibilidadEmpresa();
  const lista = [...porConvocatoria.values()].sort((a, b) => b.porcentaje - a.porcentaje);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        titulo="Sugeridas para ti"
        descripcion="Convocatorias vigentes que coinciden con tus proyectos por tipo, sector, entidad, monto y ubicación."
      />
      {lista.length === 0 ? (
        <EmptyState
          icon={proyectos === 0 ? FolderPlus : WandSparkles}
          titulo={proyectos === 0 ? "Registra tu primer proyecto" : "Aún no hay convocatorias que coincidan"}
          descripcion={
            proyectos === 0
              ? "Con un proyecto registrado cruzamos sus datos con el catálogo y te mostramos aquí las que mejor le pegan."
              : "Completa el tipo, el sector, el monto y el departamento de tus proyectos para mejorar el cruce, o revisa el catálogo completo."
          }
          accion={
            <LinkButton href={proyectos === 0 ? "/proyectos" : "/convocatorias"}>
              {proyectos === 0 ? "Crear proyecto" : "Ver convocatorias"}
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,340px),1fr))] gap-3.5">
          {lista.map((s) => {
            const c = s.convocatoria;
            const dias = diasRestantes(c.fechaCierre);
            const tributario = c.tipo === "beneficio_tributario";
            return (
              <Link
                key={c.id}
                href={`/convocatorias/${c.id}`}
                className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-[18px] shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-pri"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <CompatRing porcentaje={s.porcentaje} />
                  <Badge tono={tributario ? "violet" : "pri"}>{tributario ? "Tributario" : "Fondos"}</Badge>
                </div>
                <div>
                  <h2 className="text-[15px] font-extrabold leading-snug [text-wrap:pretty]">{c.nombre}</h2>
                  <p className="mt-1 text-[12.5px] text-ink-3">{c.entidadConvocante}</p>
                </div>
                <p className="text-xs text-ink-2">
                  Para tu proyecto <span className="font-bold text-ink">{s.proyectoNombre}</span>
                </p>
                <CompatBreakdown
                  criterios={s.criterios.map((k) => ({
                    nombre: k.etiqueta,
                    estado: k.estado === "cumple" ? "coincide" : "parcial",
                    resultado: k.estado === "cumple" ? "Coincide" : k.estado === "sin_dato" ? "Falta el dato" : k.estado === "sin_tasa" ? "Otra moneda, sin tasa" : "Revisar",
                  }))}
                />
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-line-2 pt-3">
                  <span className="font-tabular text-sm font-semibold">{formatRangoConvocatoria(c)}</span>
                  {dias < 15 ? (
                    <DeadlineChip dias={dias} />
                  ) : (
                    <span className="text-xs font-semibold text-ink-2">Cierra en {dias} días</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
