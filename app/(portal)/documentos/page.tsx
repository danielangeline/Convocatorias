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
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-700">
          <Sparkles className="h-3.5 w-3.5" /> Módulo de IA
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Documentos generados</h1>
        <p className="text-sm text-ink-soft">
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
                className="flex flex-col rounded-2xl border border-line p-5 transition-colors hover:border-teal-200 hover:bg-teal-50/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge className={ESTADO_DOCUMENTO_ESTILO[doc.estado]}>{ESTADO_DOCUMENTO_LABEL[doc.estado]}</Badge>
                  <span className="font-tabular text-xs text-ink-faint">v{doc.version}</span>
                </div>

                <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">
                  {proyecto?.nombre ?? "Proyecto no disponible"}
                </h3>
                <p className="mt-1 text-sm text-ink-soft">{convocatoria?.nombre ?? "Convocatoria no disponible"}</p>

                <div className="mt-4 flex items-center justify-between border-t border-line-soft pt-4 text-xs text-ink-faint">
                  <span>Actualizado: {formatFecha(doc.fechaActualizacion)}</span>
                  {pendientes > 0 ? (
                    <Badge className="bg-amber-50 text-amber-700 ring-amber-200">{pendientes} pendientes</Badge>
                  ) : (
                    <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-200">Sin pendientes</Badge>
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
