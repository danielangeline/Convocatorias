import { connection } from "next/server";
import { EventosSeguridad } from "@/components/admin/EventosSeguridad";
import { LIMITE_EVENTOS, listarEventosSeguridad } from "@/lib/admin/seguridad";

export const metadata = { title: "Seguridad · Panel admin" };

// CU-39 · RF-65. El layout del panel ya exigió administrador con MFA; la RLS lo repite.
// Sesión 030: lee los eventos reales; antes eran los datos de ejemplo del store.
export default async function SeguridadAdminPage() {
  await connection();
  const { eventos, ahora } = await listarEventosSeguridad();
  return <EventosSeguridad eventos={eventos} ahora={ahora} limite={LIMITE_EVENTOS} />;
}
