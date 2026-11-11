import Link from "next/link";
import { FileText } from "lucide-react";
import { listarDocumentos } from "@/lib/documentos-servidor";
import { formatFecha } from "@/lib/utils";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

// RN-22, RN-27 · Solo los documentos que una empresa le autorizó y cuyo encargo
// sigue en curso: lo decide la RLS en cada petición, no la pantalla.
export default async function DocumentosConsultorPage() {
  const documentos = await listarDocumentos();

  return (
    <GuardaConsultor>
      <div className="flex flex-col gap-5">
        <PageHeader
          titulo="Documentos"
          descripcion="Borradores que una empresa te autorizó para un encargo en curso. Puedes leerlos, editarlos y pedir ajustes con IA, pero no descargarlos; al terminar el encargo dejas de verlos."
        />

        {documentos.length === 0 ? (
          <EmptyState
            icon={FileText}
            titulo="Aún no tienes documentos compartidos"
            descripcion="Cuando una empresa autorice tu acceso a un documento generado con IA, aparecerá aquí."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {documentos.map((doc) => (
              <article
                key={doc.id}
                className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-md border border-line bg-surface p-5 transition-colors hover:border-pri"
              >
                <div className="min-w-0 flex-[1_1_300px]">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Badge tono="aviso">Puede editar</Badge>
                    <span className="font-tabular text-xs text-ink-3">
                      v{doc.version} · {formatFecha(doc.actualizadoAt.slice(0, 10))}
                    </span>
                  </div>
                  <h2 className="mt-2 font-display text-lg font-semibold leading-snug text-ink">{doc.proyectoNombre}</h2>
                  <p className="mt-0.5 text-sm text-ink-2">{doc.convocatoriaNombre}</p>
                </div>
                <div className="flex items-center gap-4">
                  {doc.pendientes.length > 0 ? (
                    <span className="text-[13px] font-semibold text-ink-2">
                      <span className="font-tabular">{doc.pendientes.length}</span>{" "}
                      {doc.pendientes.length === 1 ? "apartado por completar" : "apartados por completar"}
                    </span>
                  ) : (
                    <span className="text-[13px] text-ink-3">Sin pendientes</span>
                  )}
                  <Link
                    href={`/consultor/documentos/${doc.id}`}
                    className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-[4px] border border-pri bg-surface px-4 text-sm font-semibold text-pri-text hover:bg-pri-soft"
                  >
                    Abrir
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </GuardaConsultor>
  );
}
