import { GestionCategorias } from "@/components/admin/GestionCategorias";
import { listarCategorias } from "@/lib/admin/catalogo";

export const metadata = { title: "Categorías · Panel admin" };

// RF-06. El layout del panel ya exigió administrador con MFA; la RLS lo repite.
export default async function AdminCategoriasPage() {
  return <GestionCategorias categorias={await listarCategorias()} />;
}
