"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useCreditos, useDocumentosPropios, usePlanEfectivo, useProyectosPropios, useTarifas } from "@/lib/hooks";
import { AvisoFuncionBloqueada, PantallaBloqueada } from "@/components/plan/FuncionBloqueada";
import { extraerPendientes } from "@/lib/documentos";
import { formatFecha } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

// CU-33, CU-34 · Documentos generados con IA de la empresa (RN-30). Cada uso de
// la IA cuesta su tarifa vigente en créditos (RN-17, RF-100); los créditos se
// muestran siempre como documentos.
export default function DocumentosPage() {
  const documentos = useDocumentosPropios();
  const proyectos = useProyectosPropios();
  const convocatorias = useAppStore((s) => s.convocatorias);
  const tarifas = useTarifas();
  const { disponibles } = useCreditos();
  const alcanzan = tarifas.generacion > 0 ? Math.floor(disponibles / tarifas.generacion) : 0;
  const abrirCreditos = useAppStore((s) => s.abrirModalCreditos);

  const ordenados = [...documentos].sort((a, b) => (a.fechaActualizacion < b.fechaActualizacion ? 1 : -1));
  // RN-41, RF-120 (sesión 042): sin la función, los documentos que ya tiene se
  // ven y se descargan; sin ninguno, la pantalla explica en qué plan está.
  const conFuncion = usePlanEfectivo().incluye("documento_ia");
  if (!conFuncion && documentos.length === 0) return <PantallaBloqueada funcion="documento_ia" titulo="Documentos con IA" />;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Documentos con IA"
        titulo="Documentos"
        descripcion="Borradores de propuesta generados con IA a partir de tus proyectos y las convocatorias."
      />

      {!conFuncion && (
        <AvisoFuncionBloqueada
          funcion="documento_ia"
          texto="Sus documentos siguen aquí: puede verlos, editarlos a mano y exportarlos, pero no generar nuevos ni ajustarlos con IA"
        />
      )}
      {/* Banda informativa en una línea: tarifas reales y créditos traducidos a documentos. */}
      {conFuncion && <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-[4px] bg-pri-soft px-4 py-3 text-[13.5px] text-pri-text">
        <span>
          Cada documento usa <strong className="font-tabular font-medium">{tarifas.generacion.toLocaleString("es-CO")}</strong> créditos y cada ajuste,{" "}
          <strong className="font-tabular font-medium">{tarifas.ajuste.toLocaleString("es-CO")}</strong>. Te quedan{" "}
          <strong className="font-tabular font-medium">{disponibles.toLocaleString("es-CO")}</strong>: alcanzan para{" "}
          <strong className="font-tabular font-medium">{alcanzan.toLocaleString("es-CO")}</strong> {alcanzan === 1 ? "documento" : "documentos"}.
        </span>
        <span aria-hidden>·</span>
        <button type="button" onClick={() => abrirCreditos("conseguir más créditos")} className="min-h-11 cursor-pointer font-semibold underline">
          Conseguir más
        </button>
      </p>}

      {ordenados.length === 0 ? (
        <EmptyState
          icon={FileText}
          titulo="Aún no has generado documentos"
          descripcion="Desde la ficha de una convocatoria o de un proyecto puedes generar un borrador de propuesta con IA."
          accion={
            <LinkButton href="/convocatorias" variant="primary">
              Explorar convocatorias
            </LinkButton>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {ordenados.map((doc) => {
            const proyecto = proyectos.find((p) => p.id === doc.proyectoId);
            const convocatoria = convocatorias.find((c) => c.id === doc.convocatoriaId);
            const pendientes = extraerPendientes(doc.secciones).length;
            const listo = doc.estado === "exportado";

            return (
              <article
                key={doc.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-5 transition-colors hover:border-pri"
              >
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tono={listo ? "ok" : "aviso"}>{listo ? "Listo" : "Borrador"}</Badge>
                    <span className="font-tabular text-xs text-ink-3">
                      v{doc.version} · {formatFecha(doc.fechaActualizacion)}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-lg font-semibold leading-snug text-ink">{proyecto?.nombre ?? "Proyecto no disponible"}</h2>
                  <p className="mt-0.5 text-sm text-ink-2">{convocatoria?.nombre ?? "Convocatoria no disponible"}</p>
                </div>
                <div className="flex items-center gap-4">
                  {pendientes > 0 ? (
                    <span className="text-[13px] font-semibold text-ink-2">
                      <span className="font-tabular">{pendientes}</span> {pendientes === 1 ? "apartado por completar" : "apartados por completar"}
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-3">Sin pendientes</span>
                  )}
                  <Link
                    href={`/documentos/${doc.id}`}
                    className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[4px] border border-pri bg-surface px-4 text-sm font-semibold text-pri-text hover:bg-pri-soft"
                  >
                    Abrir
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
