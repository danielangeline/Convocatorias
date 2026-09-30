import { SolicitudesEquipo } from "@/components/admin/SolicitudesEquipo";
import { listarSolicitudesEquipo } from "@/lib/encargos-servidor";

// CU-26, RF-90 · Bandeja de solicitudes al equipo y las ya atendidas, leídas
// con la sesión del administrador (la base exige aal2).
export default async function AdminEncargosPage() {
  const [esperando, atendidas] = await Promise.all([
    listarSolicitudesEquipo("esperando_asignacion"),
    listarSolicitudesEquipo("atendido"),
  ]);
  return <SolicitudesEquipo esperando={esperando} atendidas={atendidas} />;
}
