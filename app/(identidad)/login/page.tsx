import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { rutaInicioDeRol } from "@/lib/rutas";
import { FormularioLogin } from "@/components/identidad/FormularioLogin";

export const metadata = { title: "Iniciar sesión · Gestión de Convocatorias" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const datos = await obtenerSesion();
  if (datos) {
    const { rol, aal } = datos.sesion;
    redirect(rol === "administrador" && aal !== "aal2" ? "/mfa" : rutaInicioDeRol(rol));
  }

  const { error } = await searchParams;

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-ink-soft">Entra con el correo y la contraseña de tu cuenta.</p>
      <FormularioLogin errorInicial={error === "enlace" ? "El enlace de confirmación no es válido o ya expiró." : undefined} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-semibold text-primary-800 hover:underline">
          Regístrate
        </Link>
      </p>
    </>
  );
}
