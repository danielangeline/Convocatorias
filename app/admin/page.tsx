import { DashboardPanel } from "@/components/admin/DashboardPanel";
import { datosTablero } from "@/lib/admin/tablero";
import { contarSolicitudesEquipo } from "@/lib/encargos-servidor";

// RF-42, RF-34, RF-90 · Dashboard del panel, con datos reales leídos con la
// sesión del administrador (aal2, RNF-28).
export default async function AdminDashboardPage() {
  const [datos, solicitudesEquipo] = await Promise.all([datosTablero(), contarSolicitudesEquipo()]);
  return <DashboardPanel datos={datos} solicitudesEquipo={solicitudesEquipo} />;
}
