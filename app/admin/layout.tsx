import { redirect } from "next/navigation";
import { AdminShell } from "@/components/shell/AdminShell";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { exigirRol } from "@/lib/auth";
import { contarSolicitudesEquipo } from "@/lib/encargos-servidor";
import { contarPerfilesEnRevision } from "@/lib/shell-contadores";

// Ninguna sesión administrativa opera sin segundo factor verificado (RNF-28,
// RF-64): un administrador en aal1 va a /mfa. Se comprueba en el servidor en
// cada petición; la RLS además niega todo privilegio sin aal2.
// Para quien no es administrador el panel no existe: 404 (RF-85, RNF-35).
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["administrador"], { ruta: "panel", oculta: true });
  if (datos.sesion.rol === "administrador" && datos.sesion.aal !== "aal2") redirect("/mfa");
  // RF-90: las solicitudes que esperan al equipo y (RF-34) los perfiles en revisión llevan su número en el menú.
  const [solicitudesEquipo, perfilesEnRevision] = await Promise.all([
    contarSolicitudesEquipo(),
    contarPerfilesEnRevision(),
  ]);

  return (
    <>
      <SincronizarSesion datos={datos} />
      <AdminShell
        esPropietario={datos.sesion.esPropietario}
        contadores={{
          "/admin/encargos": solicitudesEquipo,
          "/admin/consultores/revision": perfilesEnRevision,
        }}
      >
        <main className="flex-1">{children}</main>
      </AdminShell>
    </>
  );
}
