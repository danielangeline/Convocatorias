import { GestionFuentes } from "@/components/admin/GestionFuentes";
import { listarFuentes } from "@/lib/admin/catalogo";

export const metadata = { title: "Fuentes · Panel admin" };

// CU-01 · RF-04. El layout del panel ya exigió administrador con MFA; la lectura
// va con esa sesión, así que la RLS también lo exige.
export default async function AdminFuentesPage() {
  return <GestionFuentes fuentes={await listarFuentes()} />;
}
