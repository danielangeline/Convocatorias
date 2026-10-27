import Link from "next/link";
import { EditorDocumento } from "@/components/documentos/EditorDocumento";
import { obtenerDocumento } from "@/lib/documentos-servidor";
import { listarEncargosEmpresa } from "@/lib/encargos-servidor";

// CU-34 · Documento leído con la sesión de la empresa: si la RLS no deja verlo,
// para ella no existe (RN-22, RN-30).
export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [documento, encargos] = await Promise.all([obtenerDocumento(id), listarEncargosEmpresa()]);

  if (!documento) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink-2">No encontramos este documento.</p>
        <Link href="/documentos" className="mt-3 inline-block text-sm font-semibold text-pri-text hover:underline">
          Volver a mis documentos
        </Link>
      </div>
    );
  }

  // RF-71: solo se puede autorizar al consultor de un encargo en curso sobre el proyecto.
  const encargo = encargos.find((e) => e.proyectoId === documento.proyectoId && e.estado === "en_curso" && e.consultor);
  return (
    <EditorDocumento
      documento={documento}
      rol="empresa"
      consultorEncargo={encargo?.consultor ? { id: encargo.consultor.id, nombre: encargo.consultor.nombre } : null}
      volverHref="/documentos"
      volverTexto="Volver a mis documentos"
      proyectoHref={`/proyectos/${documento.proyectoId}`}
      convocatoriaHref={`/convocatorias/${documento.convocatoriaId}`}
    />
  );
}
