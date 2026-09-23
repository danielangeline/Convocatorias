import { FichaConvocatoria } from "@/components/catalogo/FichaConvocatoria";
import { listarCategoriasActivas, obtenerFicha } from "@/lib/catalogo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RF-13, CU-08 · Ficha leída con la sesión de la empresa: si la RLS no deja
// verla, para ella no existe (RN-33).
export default async function DetalleConvocatoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [convocatoria, categorias] = await Promise.all([
    UUID.test(id) ? obtenerFicha(id) : Promise.resolve(null),
    listarCategoriasActivas(),
  ]);
  return <FichaConvocatoria convocatoria={convocatoria} categorias={categorias} />;
}
