import { FichaProyecto } from "@/components/proyectos/FichaProyecto";
import type { CampoEditable } from "@/components/ProyectoFormModal";
import { listarCategoriasActivas } from "@/lib/catalogo";
import { obtenerProyecto } from "@/lib/proyectos-servidor";

const EDITABLES_DESDE_SUGERENCIAS: CampoEditable[] = ["montoBuscado", "departamento", "categorias"];

// CU-09, RF-46, RF-81 · Ficha del proyecto. Uno ajeno no existe para quien pide (RN-30).
// `?editar=` abre la edición en un dato de clasificación que piden las sugerencias (CU-10 2a).
export default async function DetalleProyectoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ editar?: string }>;
}) {
  const [{ id }, { editar }] = await Promise.all([params, searchParams]);
  const [proyecto, categorias] = await Promise.all([obtenerProyecto(id), listarCategoriasActivas()]);
  const campo = EDITABLES_DESDE_SUGERENCIAS.find((c) => c === editar) ?? null;
  return <FichaProyecto proyecto={proyecto} categorias={categorias} editar={campo} />;
}
