import { FichaProyecto } from "@/components/proyectos/FichaProyecto";
import { listarCategoriasActivas } from "@/lib/catalogo";
import { obtenerProyecto } from "@/lib/proyectos-servidor";

// CU-09, RF-46, RF-81 · Ficha del proyecto. Uno ajeno no existe para quien pide (RN-30).
export default async function DetalleProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [proyecto, categorias] = await Promise.all([obtenerProyecto(id), listarCategoriasActivas()]);
  return <FichaProyecto proyecto={proyecto} categorias={categorias} />;
}
