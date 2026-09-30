import { DashboardPanel } from "@/components/admin/DashboardPanel";
import { contarSolicitudesEquipo } from "@/lib/encargos-servidor";

export default async function AdminDashboardPage() {
  return <DashboardPanel solicitudesEquipo={await contarSolicitudesEquipo()} />;
}
