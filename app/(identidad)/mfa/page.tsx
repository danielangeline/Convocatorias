import { redirect } from "next/navigation";
import { exigirRol } from "@/lib/auth";
import { FormularioMfa } from "@/components/identidad/FormularioMfa";
import { MenuUsuario } from "@/components/MenuUsuario";
import { SincronizarSesion } from "@/components/SincronizarSesion";

export const metadata = { title: "Verificación en dos pasos · Gestión de Convocatorias", robots: { index: false, follow: false } };

// CU-38, RF-64, RNF-28: toda sesión de administrador sin aal2 termina aquí.
// Para cualquier otro usuario la ruta no existe (RF-85).
export default async function MfaPage() {
  const datos = await exigirRol(["administrador"], { ruta: "verificación en dos pasos", oculta: true });
  if (datos.sesion.aal === "aal2") redirect("/admin");

  return (
    <>
      <SincronizarSesion datos={datos} />
      <FormularioMfa />
      <div className="mt-6 flex justify-center border-t border-line-soft pt-4">
        <MenuUsuario tono="primary" />
      </div>
    </>
  );
}
