import Link from "next/link";
import { FormularioRecuperar } from "@/components/identidad/FormularioRecuperar";

export const metadata = { title: "Recuperar contraseña · FundRadar" };

// RF-03, CU-14 paso 5.
export default function RecuperarPage() {
  return (
    <>
      <h1 className="font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">Recuperar contraseña</h1>
      <p className="mt-1 text-sm text-ink-2">Escriba el correo de su cuenta y le enviaremos un enlace para definir una nueva.</p>
      <FormularioRecuperar />
      <p className="mt-6 text-center text-sm text-ink-2">
        ¿La recordó?{" "}
        <Link href="/login" className="font-semibold text-pri-text hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
