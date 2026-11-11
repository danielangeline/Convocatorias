import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { puertaDeParametro, rutaInicioDeRol } from "@/lib/rutas";
import { FormularioLogin } from "@/components/identidad/FormularioLogin";

export const metadata = { title: "Iniciar sesión · FundRadar" };

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
      <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">Iniciar sesión</h1>
      <p className="mt-1 text-sm text-ink-2">Elija su puerta y entre con el correo y la contraseña de su cuenta.</p>
      <FormularioLogin
        puertaInicial={puertaInicial}
        errorInicial={error === "enlace" ? "El enlace de confirmación no es válido o ya expiró." : undefined}
      />
      <p className="mt-6 text-center text-sm text-ink-2">
        ¿Aún no tiene cuenta?{" "}
        <Link href={`/registro?puerta=${puertaInicial}`} className="font-semibold text-pri-text hover:underline">
          Cree una gratis
        </Link>
      </p>
    </>
  );
}
