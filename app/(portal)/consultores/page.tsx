import { DirectorioConsultores } from "@/components/consultores/DirectorioConsultores";
import { listarDirectorio } from "@/lib/consultores-directorio";

export const metadata = { title: "Directorio de consultores" };

// CU-20 · RF-26. El layout del portal ya exigió rol empresa; la RLS solo deja
// leer perfiles aprobados y la consulta deja fuera al equipo interno.
export default async function DirectorioConsultoresPage() {
  return <DirectorioConsultores consultores={await listarDirectorio()} />;
}
