import { GestionSuscripciones } from "@/components/admin/GestionSuscripciones";
import { listarCuentasYTablero, listarPlanesAdmin } from "@/lib/admin/suscripciones";

export const metadata = { title: "Suscripciones · Panel admin" };

// CU-31 pasos 2 a 5 · RF-38, RF-42, RF-51. El layout del panel ya exigió administrador con MFA; las funciones lo repiten.
export default async function AdminSuscripcionesPage() {
  const [{ cuentas, tablero }, planes] = await Promise.all([listarCuentasYTablero(), listarPlanesAdmin()]);
  return <GestionSuscripciones cuentas={cuentas} tablero={tablero} planes={planes} />;
}
