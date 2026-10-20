import { GestionPlanes } from "@/components/admin/GestionPlanes";
import { listarPlanesAdmin } from "@/lib/admin/suscripciones";

export const metadata = { title: "Planes · Panel admin" };

// CU-31 paso 1 · RF-36. El layout del panel ya exigió administrador con MFA; la RLS y las funciones lo repiten.
export default async function AdminPlanesPage() {
  return <GestionPlanes planes={await listarPlanesAdmin()} />;
}
