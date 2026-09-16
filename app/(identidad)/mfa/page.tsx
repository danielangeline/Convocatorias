import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { rutaInicioDeRol } from "@/lib/rutas";
import { FormularioMfa } from "@/components/identidad/FormularioMfa";
import { MenuUsuario } from "@/components/MenuUsuario";
import { SincronizarSesion } from "@/components/SincronizarSesion";

export const metadata = { title: "Verificación en dos pasos · Gestión de Convocatorias" };

// CU-38, RF-64, RNF-28: toda sesión de administrador sin aal2 termina aquí.
export default async function MfaPage() {
  const datos = await obtenerSesion();
  if (!datos) redirect("/login");
  if (datos.sesion.rol !== "administrador") redirect(rutaInicioDeRol(datos.sesion.rol));
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
