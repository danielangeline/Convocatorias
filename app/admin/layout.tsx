import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/AdminSidebar";
import { MenuUsuario } from "@/components/MenuUsuario";
import { SincronizarSesion } from "@/components/SincronizarSesion";
import { exigirRol } from "@/lib/auth";

// Ninguna sesión administrativa opera sin segundo factor verificado (RNF-28,
// RF-64): un administrador en aal1 va a /mfa. Se comprueba en el servidor en
// cada petición; la RLS además niega todo privilegio sin aal2.
// Para quien no es administrador el panel no existe: 404 (RF-85, RNF-35).
export const metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const datos = await exigirRol(["administrador"], { ruta: "panel", oculta: true });
  if (datos.sesion.rol === "administrador" && datos.sesion.aal !== "aal2") redirect("/mfa");

  return (
    <div className="flex min-h-screen min-w-[1024px] bg-primary-50/40">
      <SincronizarSesion datos={datos} />
      <AdminSidebar />
      <div className="flex-1 overflow-x-auto">
        <header className="flex justify-end border-b border-line bg-white px-8 py-3">
          <MenuUsuario tono="primary" />
        </header>
        <main className="px-8 py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
