import Link from "next/link";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth";
import { rutaInicioDeRol } from "@/lib/rutas";
import { FormularioRegistro } from "@/components/identidad/FormularioRegistro";

export const metadata = { title: "Crear cuenta · Gestión de Convocatorias" };

export default async function RegistroPage({ searchParams }: PageProps<"/registro">) {
  const datos = await obtenerSesion();
  if (datos) redirect(rutaInicioDeRol(datos.sesion.rol));

  const { rol } = await searchParams;

  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink">Crear cuenta</h1>
      <p className="mt-1 text-sm text-ink-soft">Elige cómo vas a usar la plataforma.</p>
      <FormularioRegistro rolInicial={rol === "consultor" ? "consultor" : "empresa"} />
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-semibold text-primary-800 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
