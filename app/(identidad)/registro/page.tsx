import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { puertaDeParametro, rutaInicioDeRol } from "@/lib/rutas";
import { FormularioRegistro } from "@/components/identidad/FormularioRegistro";

export const metadata = { title: "Crear cuenta · Gestión de Convocatorias" };

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const datos = await obtenerSesion();
  if (datos) redirect(rutaInicioDeRol(datos.sesion.rol));

  const puerta = puertaDeParametro((await searchParams).puerta);

  return (
    <>
      <h1 className="text-[26px] font-extrabold tracking-[-0.025em] text-ink">Crear cuenta</h1>
      <p className="mt-1 text-sm text-ink-2">Elige cómo vas a usar la plataforma.</p>
      <FormularioRegistro puertaInicial={puerta} />
      <p className="mt-6 text-center text-sm text-ink-2">
        ¿Ya tienes cuenta?{" "}
        <Link href={`/login?puerta=${puerta}`} className="font-semibold text-pri-text hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
