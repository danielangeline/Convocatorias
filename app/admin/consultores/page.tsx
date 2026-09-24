import { ListadoConsultores } from "@/components/admin/ListadoConsultores";
import { listarConsultores } from "@/lib/admin/consultores";

export const metadata = { title: "Consultores · Panel admin" };

// CU-27 · RF-35. El layout del panel ya exigió administrador con MFA; las
// funciones de la base lo repiten.
export default async function AdminConsultoresPage() {
  return <ListadoConsultores consultores={await listarConsultores()} />;
}
