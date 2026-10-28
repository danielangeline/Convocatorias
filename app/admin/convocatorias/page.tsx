import { ListadoConvocatorias } from "@/components/admin/ListadoConvocatorias";
import { listarCategorias, listarConvocatorias, listarFuentes } from "@/lib/admin/catalogo";

export const metadata = { title: "Convocatorias · Panel admin" };

// CU-02 · RF-05 · CU-50 (carga masiva, que muestra las categorías válidas). El layout del panel ya exigió administrador con MFA; la RLS lo repite.
export default async function AdminConvocatoriasPage() {
  const [convocatorias, fuentes, categorias] = await Promise.all([listarConvocatorias(), listarFuentes(), listarCategorias()]);
  return (
    <ListadoConvocatorias
      convocatorias={convocatorias}
      fuentesActivas={fuentes.filter((f) => f.activa)}
      categorias={categorias}
    />
  );
}
