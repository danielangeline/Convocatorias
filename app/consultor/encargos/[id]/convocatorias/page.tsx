import { notFound } from "next/navigation";
import { GuardaConsultor } from "@/components/GuardaConsultor";
import { BusquedaEncargo } from "@/components/encargos/BusquedaEncargo";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";
import { sugerenciasDeEncargo } from "@/lib/sugerencias";

// RF-91, RF-92, RN-33 (excepción) · Búsqueda desde un encargo "buscar
// convocatoria" en curso del consultor; si no lo es, 404. Todo se lee con su
// sesión: el catálogo vigente solo existe para él mientras dure el encargo.
export default async function BusquedaEncargoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const encargo = await encargoDeBusqueda(id);
  if (!encargo) notFound();
  const [sugerencias, convocatorias, categorias] = await Promise.all([
    sugerenciasDeEncargo(encargo.id, encargo.proyectoId),
    listarCatalogo(false),
    listarCategoriasActivas(),
  ]);
  return (
    <GuardaConsultor>
      <BusquedaEncargo
        encargo={encargo}
        sugerencias={sugerencias.ok ? sugerencias.datos : null}
        convocatorias={convocatorias}
        categorias={categorias}
      />
    </GuardaConsultor>
  );
}
