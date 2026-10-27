import { GestionPlantillas } from "@/components/admin/GestionPlantillas";
import { listarPlantillas, listarPlantillasProyecto } from "@/lib/admin/plantillas";

export const metadata = { title: "Plantillas · Panel admin" };

// CU-37 · RF-63, RF-99. El layout del panel ya exigió administrador con MFA; la RLS y las funciones lo repiten.
// `?tipo=proyecto` abre la plantilla de creación de proyectos (sesión 030).
export default async function AdminPlantillasPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams;
  if (tipo === "proyecto") {
    return <GestionPlantillas key="proyecto" tipo="proyecto" plantillas={await listarPlantillasProyecto()} />;
  }
  return <GestionPlantillas key="documento" tipo="documento" plantillas={await listarPlantillas()} />;
}
