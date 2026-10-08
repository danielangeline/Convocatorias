import { DashboardPanel } from "@/components/admin/DashboardPanel";
import { contarPerfilesEnRevision } from "@/lib/admin/consultores";
import { contarSolicitudesEquipo } from "@/lib/encargos-servidor";

export default async function AdminDashboardPage() {
  const [perfilesEnRevision, solicitudesEquipo] = await Promise.all([
    contarPerfilesEnRevision(),
    contarSolicitudesEquipo(),
  ]);
  return <DashboardPanel perfilesEnRevision={perfilesEnRevision} solicitudesEquipo={solicitudesEquipo} />;
}
