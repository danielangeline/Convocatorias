import { GestionPlantillas } from "@/components/admin/GestionPlantillas";
import { listarPlantillas } from "@/lib/admin/plantillas";

export const metadata = { title: "Plantillas · Panel admin" };

// CU-37 · RF-63. El layout del panel ya exigió administrador con MFA; la RLS y las funciones lo repiten.
export default async function AdminPlantillasPage() {
  return <GestionPlantillas plantillas={await listarPlantillas()} />;
}
