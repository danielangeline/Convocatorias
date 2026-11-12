import { DirectorioConsultores } from "@/components/consultores/DirectorioConsultores";
import { PantallaBloqueada } from "@/components/plan/FuncionBloqueada";
import { listarDirectorio } from "@/lib/consultores-directorio";
import { planEfectivoSesion } from "@/lib/plan-servidor";

export const metadata = { title: "Directorio de consultores" };

// CU-20 · RF-26. El layout del portal ya exigió rol empresa; la RLS solo deja
// leer perfiles aprobados y la consulta deja fuera al equipo interno.
// RN-41, RF-120 (sesión 042): el directorio es del plan Pro; sin él, la pantalla
// explica la función y el listado ni se lee.
export default async function DirectorioConsultoresPage() {
  const plan = await planEfectivoSesion();
  if (!plan?.funciones.consultores) return <PantallaBloqueada funcion="consultores" titulo="Directorio de consultores" />;
  return <DirectorioConsultores consultores={await listarDirectorio()} />;
}
