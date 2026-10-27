import { GestionPlanes } from "@/components/admin/GestionPlanes";
import { TarifasIA } from "@/components/admin/TarifasIA";
import { listarPlanesAdmin } from "@/lib/admin/suscripciones";
import { leerTarifas } from "@/lib/suscripcion-servidor";

export const metadata = { title: "Planes · Panel admin" };

// CU-31 paso 1 · RF-36, RF-100. El layout del panel ya exigió administrador con MFA; la RLS y las funciones lo repiten.
export default async function AdminPlanesPage() {
  const [planes, tarifas] = await Promise.all([listarPlanesAdmin(), leerTarifas()]);
  return (
    <>
      <GestionPlanes planes={planes} />
      <TarifasIA key={JSON.stringify(tarifas)} tarifas={tarifas} />
    </>
  );
}
