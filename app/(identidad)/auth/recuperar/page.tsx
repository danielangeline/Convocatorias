import Link from "next/link";
import { FormularioRecuperar } from "@/components/identidad/FormularioRecuperar";

export const metadata = { title: "Recuperar contraseña · Gestión de Convocatorias" };

// RF-03, CU-14 paso 5.
export default function RecuperarPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-bold text-ink">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-ink-soft">Escribe el correo de tu cuenta y te enviaremos un enlace para definir una nueva.</p>
      <FormularioRecuperar />
      <p className="mt-6 text-center text-sm text-ink-soft">
        ¿La recordaste?{" "}
        <Link href="/login" className="font-semibold text-primary-800 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
