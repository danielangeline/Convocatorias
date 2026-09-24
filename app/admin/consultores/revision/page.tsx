import { BandejaRevision } from "@/components/admin/BandejaRevision";
import { listarConsultores } from "@/lib/admin/consultores";

export const metadata = { title: "Perfiles en revisión · Panel admin" };

// CU-25 · RF-34. El layout del panel ya exigió administrador con MFA; las
// funciones de la base lo repiten.
export default async function RevisionConsultoresPage() {
  return <BandejaRevision consultores={await listarConsultores("en_revision")} />;
}
