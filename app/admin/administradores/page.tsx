import { GestionAdministradores } from "@/components/admin/GestionAdministradores";
import { listarAdministradores } from "@/lib/admin/administradores";
import { exigirPropietario } from "@/lib/auth";

export const metadata = { title: "Administradores · Panel admin" };

// CU-41 · Solo el Propietario: a cualquier otra sesión, incluido otro
// administrador, 404 (RF-86). proxy.ts lo aplica primero; esto es la segunda barrera.
export default async function AdministradoresPage() {
  const datos = await exigirPropietario("/admin/administradores");
  const listado = await listarAdministradores();
  return <GestionAdministradores listado={listado} propietarioId={datos.sesion.usuarioId} />;
}
