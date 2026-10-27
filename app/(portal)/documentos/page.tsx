"use client";

import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { useAppStore } from "@/lib/store";
import { useDocumentosPropios, useProyectosPropios } from "@/lib/hooks";
import { extraerPendientes, ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_ESTILO } from "@/lib/documentos";
import { formatFecha } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";

export default function DocumentosPage() {
  const documentos = useDocumentosPropios();
  const proyectos = useProyectosPropios();
  const convocatorias = useAppStore((s) => s.convocatorias);

  const ordenados = [...documentos].sort((a, b) => (a.fechaActualizacion < b.fechaActualizacion ? 1 : -1));

  return (
    <div>
      <div className="mb-6">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-ink">
          <Sparkles className="h-3.5 w-3.5" /> Módulo de IA
        </p>
        <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.025em] text-ink">Documentos generados</h1>
        <p className="text-sm text-ink-2">
          Borradores de propuesta generados con IA a partir de tus proyectos y las convocatorias.
        </p>
      </div>

      {ordenados.length === 0 ? (
        <EmptyState
          icon={FileText}
          titulo="Aún no has generado documentos"
          descripcion="Desde la ficha de una convocatoria o de un proyecto puedes generar un borrador de propuesta con IA."
          accion={
            <LinkButton href="/convocatorias" variant="teal">
              Explorar convocatorias
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ordenados.map((doc) => {
            const proyecto = proyectos.find((p) => p.id === doc.proyectoId);
            const convocatoria = convocatorias.find((c) => c.id === doc.convocatoriaId);
            const pendientes = extraerPendientes(doc.secciones).length;

            return (
              <Link
                key={doc.id}
                href={`/documentos/${doc.id}`}
                className="flex flex-col rounded-2xl border border-line p-5 transition-colors hover:border-violet/30 hover:bg-violet/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge className={ESTADO_DOCUMENTO_ESTILO[doc.estado]}>{ESTADO_DOCUMENTO_LABEL[doc.estado]}</Badge>
                  <span className="font-tabular text-xs text-ink-3">v{doc.version}</span>
                </div>

                <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">
                  {proyecto?.nombre ?? "Proyecto no disponible"}
                </h3>
                <p className="mt-1 text-sm text-ink-2">{convocatoria?.nombre ?? "Convocatoria no disponible"}</p>

                <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-4 text-xs text-ink-3">
                  <span>Actualizado: {formatFecha(doc.fechaActualizacion)}</span>
                  {pendientes > 0 ? (
                    <Badge className="bg-amber/10 text-amber-ink ring-amber/30">{pendientes} pendientes</Badge>
                  ) : (
                    <Badge className="bg-pri-soft text-pri-text ring-pri/30">Sin pendientes</Badge>
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
