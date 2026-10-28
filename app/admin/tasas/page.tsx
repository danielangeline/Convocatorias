import { GestionTasas } from "@/components/admin/GestionTasas";
import { listarTasasAdmin } from "@/lib/admin/tasas";
import { listarMonedas } from "@/lib/catalogo";

export const metadata = { title: "Tasas de referencia · Panel admin" };

// RF-117, RN-40. El layout del panel ya exigió administrador con MFA; la RLS lo repite.
export default async function AdminTasasPage() {
  const [tasas, monedas] = await Promise.all([listarTasasAdmin(), listarMonedas()]);
  return <GestionTasas tasas={tasas} monedas={monedas} />;
}
