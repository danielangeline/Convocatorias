import { notFound } from "next/navigation";
import { EditorConvocatoria } from "@/components/admin/EditorConvocatoria";
import { listarCategorias, listarFuentes, obtenerConvocatoria } from "@/lib/admin/catalogo";

export const metadata = { title: "Editar convocatoria · Panel admin" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// CU-02, CU-04 · RF-05, RF-06, RF-08. El layout del panel ya exigió
// administrador con MFA; la lectura va con esa sesión y la RLS lo repite.
export default async function EditorConvocatoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const [convocatoria, categorias, fuentes] = await Promise.all([
    obtenerConvocatoria(id),
    listarCategorias(),
    listarFuentes(),
  ]);
  if (!convocatoria) notFound();

  return <EditorConvocatoria key={convocatoria.id} convocatoria={convocatoria} categorias={categorias} fuentes={fuentes} />;
}
