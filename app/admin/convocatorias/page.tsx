import { ListadoConvocatorias } from "@/components/admin/ListadoConvocatorias";
import { listarConvocatorias, listarFuentes } from "@/lib/admin/catalogo";

export const metadata = { title: "Convocatorias · Panel admin" };

// CU-02 · RF-05. El layout del panel ya exigió administrador con MFA; la RLS lo repite.
export default async function AdminConvocatoriasPage() {
  const [convocatorias, fuentes] = await Promise.all([listarConvocatorias(), listarFuentes()]);
  return <ListadoConvocatorias convocatorias={convocatorias} fuentesActivas={fuentes.filter((f) => f.activa)} />;
}
