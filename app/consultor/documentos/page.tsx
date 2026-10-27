import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { ESTADO_DOCUMENTO_LABEL, ESTADO_DOCUMENTO_ESTILO } from "@/lib/documentos";
import { listarDocumentos } from "@/lib/documentos-servidor";
import { formatFecha } from "@/lib/utils";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

// RN-22, RN-27 · Solo los documentos que una empresa le autorizó y cuyo encargo
// sigue en curso: lo decide la RLS en cada petición, no la pantalla.
export default async function DocumentosConsultorPage() {
  const documentos = await listarDocumentos();

  return (
    <GuardaConsultor>
      <div>
        <div className="mb-6">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-ink">
            <Sparkles className="h-3.5 w-3.5" /> Módulo de IA
          </p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-[-0.025em] text-ink">Documentos</h1>
          <p className="text-sm text-ink-2">
            Borradores generados con IA que una empresa te autorizó para un encargo en curso. Puedes leerlos, editarlos
            y pedir ajustes con IA, pero no descargarlos. Al terminar el encargo dejas de verlos.
          </p>
        </div>

        {documentos.length === 0 ? (
          <EmptyState
            icon={FileText}
            titulo="Aún no tienes documentos compartidos"
            descripcion="Cuando una empresa autorice tu acceso a un documento generado con IA, aparecerá aquí."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {documentos.map((doc) => (
              <Link
                key={doc.id}
                href={`/consultor/documentos/${doc.id}`}
                className="flex flex-col rounded-2xl border border-line p-5 transition-colors hover:border-violet/30 hover:bg-violet/10"
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge className={ESTADO_DOCUMENTO_ESTILO[doc.estado]}>{ESTADO_DOCUMENTO_LABEL[doc.estado]}</Badge>
                  <span className="font-tabular text-xs text-ink-3">v{doc.version}</span>
                </div>
                <h3 className="mt-3 font-display text-base font-semibold leading-snug text-ink">{doc.proyectoNombre}</h3>
                <p className="mt-1 text-sm text-ink-2">{doc.convocatoriaNombre}</p>
                <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-4 text-xs text-ink-3">
                  <span>Actualizado: {formatFecha(doc.actualizadoAt.slice(0, 10))}</span>
                  {doc.pendientes.length > 0 && (
                    <Badge className="bg-amber/10 text-amber-ink ring-amber/30">{doc.pendientes.length} pendientes</Badge>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </GuardaConsultor>
  );
}
