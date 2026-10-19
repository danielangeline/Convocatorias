import { Lock } from "lucide-react";
import { EditorDocumento } from "@/components/documentos/EditorDocumento";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/Button";
import { obtenerDocumento, registrarLectura } from "@/lib/documentos-servidor";
import { obtenerSesion } from "@/lib/auth";

// CU-34 5c · El consultor autorizado con encargo en curso (RN-27, evaluado por
// la RLS en esta misma lectura). Cada apertura queda registrada (RF-79).
export default async function DocumentoConsultorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [documento, datos] = await Promise.all([obtenerDocumento(id), obtenerSesion()]);

  if (!documento || !datos) {
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

  await registrarLectura(datos.sesion.usuarioId, documento.id);
  return (
    <GuardaConsultor>
      <EditorDocumento documento={documento} rol="consultor" volverHref="/consultor/documentos" volverTexto="Volver a mis documentos" />
    </GuardaConsultor>
  );
}
