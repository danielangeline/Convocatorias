import { Lock } from "lucide-react";
import { EditorDocumento } from "@/components/documentos/EditorDocumento";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { obtenerDocumento } from "@/lib/documentos-servidor";

// CU-34 5c · El consultor autorizado con encargo en curso (RN-27, evaluado por
// la RLS en esta misma lectura). Cada apertura queda registrada (RF-79).
export default async function DocumentoConsultorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // La lectura la registra la base en la misma llamada (RF-79).
  const documento = await obtenerDocumento(id);

  if (!documento) {
    return (
      <div className="mx-auto max-w-2xl py-16">
        <EmptyState
          icon={Lock}
          titulo="No tienes acceso a este documento"
          descripcion="La empresa no te lo ha compartido, o el encargo que lo sustentaba ya terminó."
          accion={
            <LinkButton href="/consultor/documentos" variant="secondary">
              Ver mis documentos
            </LinkButton>
          }
        />
      </div>
    );
  }

  return (
    <GuardaConsultor>
      <EditorDocumento documento={documento} rol="consultor" volverHref="/consultor/documentos" volverTexto="Volver a mis documentos" />
    </GuardaConsultor>
  );
}
