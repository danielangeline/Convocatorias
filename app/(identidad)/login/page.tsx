import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { puertaDeParametro, rutaInicioDeRol } from "@/lib/rutas";
import { FormularioLogin } from "@/components/identidad/FormularioLogin";

export const metadata = { title: "Iniciar sesión · Gestión de Convocatorias" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const datos = await obtenerSesion();
  if (datos) {
    const { rol, aal } = datos.sesion;
    redirect(rol === "administrador" && aal !== "aal2" ? "/mfa" : rutaInicioDeRol(rol));
  }

  const { error, puerta } = await searchParams;
  const puertaInicial = puertaDeParametro(puerta);

  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-ink-2">Elige tu puerta y entra con el correo y la contraseña de tu cuenta.</p>
      <FormularioLogin
        puertaInicial={puertaInicial}
        errorInicial={error === "enlace" ? "El enlace de confirmación no es válido o ya expiró." : undefined}
      />
      <p className="mt-6 text-center text-sm text-ink-2">
        ¿No tienes cuenta?{" "}
        <Link href={`/registro?puerta=${puertaInicial}`} className="font-semibold text-pri-text hover:underline">
          Regístrate
        </Link>
      </p>
    </>
  );
}
