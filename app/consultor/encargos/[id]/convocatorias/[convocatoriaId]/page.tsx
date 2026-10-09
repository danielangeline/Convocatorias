import { notFound } from "next/navigation";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { FichaConvocatoria } from "@/components/catalogo/FichaConvocatoria";
import { ProponerConvocatoria } from "@/components/encargos/ProponerConvocatoria";
import { listarCategoriasActivas, obtenerFicha } from "@/lib/catalogo";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RF-91, RF-92, CU-08 · Ficha desde el encargo, sin postular ni generar: en su
// lugar, proponer. Solo vigentes; si el encargo no es una búsqueda en curso del
// consultor, 404.
export default async function FichaEncargoPage({ params }: { params: Promise<{ id: string; convocatoriaId: string }> }) {
  const { id, convocatoriaId } = await params;
  const encargo = await encargoDeBusqueda(id);
  if (!encargo) notFound();
  const [ficha, categorias] = await Promise.all([
    UUID.test(convocatoriaId) ? obtenerFicha(convocatoriaId) : Promise.resolve(null),
    listarCategoriasActivas(),
  ]);
  const convocatoria = ficha?.estado === "publicada" ? ficha : null;
  const propuesta = encargo.propuestas.find((p) => p.convocatoriaId === convocatoriaId) ?? null;

  return (
    <GuardaConsultor>
      <FichaConvocatoria
        convocatoria={convocatoria}
        categorias={categorias}
        volver={{ href: `/consultor/encargos/${encargo.id}/convocatorias`, etiqueta: "Volver a la búsqueda" }}
        documentosBase={`/api/consultor/encargos/${encargo.id}/convocatorias/${convocatoriaId}/documentos`}
        acciones={
          convocatoria && (
            <ProponerConvocatoria
              encargoId={encargo.id}
              convocatoriaId={convocatoria.id}
              empresaNombre={encargo.empresaNombre}
              propuesta={propuesta}
              admitePropuestas={!encargo.propuestas.some((p) => p.estado === "elegida")}
              urlPostulacion={convocatoria.urlPostulacion}
            />
          )
        }
      />
    </GuardaConsultor>
  );
}
