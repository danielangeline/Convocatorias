"use client";

import { useActionState, useState } from "react";
import { Building2, HardHat, MailCheck } from "lucide-react";
import { registrarse } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { Aviso, Campo } from "./Campo";

type Rol = "empresa" | "consultor";

const opciones: { rol: Rol; titulo: string; detalle: string; icono: typeof Building2 }[] = [
  {
    rol: "empresa",
    titulo: "Empresa",
    detalle: "Busca convocatorias y prepara postulaciones. Prueba gratis 7 días con 3 créditos de IA.",
    icono: Building2,
  },
  {
    rol: "consultor",
    titulo: "Consultor",
    detalle: "Ofrece tus servicios. Tu perfil pasa por revisión antes de publicarse.",
    icono: HardHat,
  },
];

// CU-14, RF-01: el administrador no se elige aquí; se asigna manualmente (RN-06).
export function FormularioRegistro({ rolInicial }: { rolInicial: Rol }) {
  const [rol, setRol] = useState<Rol>(rolInicial);
  const [estado, accion, enviando] = useActionState(registrarse, {});

  if (estado.mensaje) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700">
          <MailCheck className="h-6 w-6" />
        </span>
        <p className="font-display text-lg font-bold text-ink">Revisa tu correo</p>
        <p className="text-sm text-ink-soft">{estado.mensaje}</p>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-6 space-y-4">
      <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <legend className="sr-only">Tipo de cuenta</legend>
        {opciones.map(({ rol: valor, titulo, detalle, icono: Icono }) => (
          <label
            key={valor}
            className={cn(
              "cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-100",
              rol === valor
                ? valor === "empresa"
                  ? "border-primary-500 bg-primary-50"
                  : "border-brick-500 bg-brick-50"
                : "border-line hover:bg-slate-50"
            )}
          >
            <input
              type="radio"
              name="rol"
              value={valor}
              checked={rol === valor}
              onChange={() => setRol(valor)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 font-semibold text-ink">
              <Icono className="h-4 w-4" /> {titulo}
            </span>
            <span className="mt-1 block text-xs text-ink-soft">{detalle}</span>
          </label>
        ))}
      </fieldset>

      <Campo etiqueta="Tu nombre" name="nombre" autoComplete="name" required />
      {rol === "empresa" && (
        <Campo etiqueta="Nombre de la empresa" name="nombre_empresa" autoComplete="organization" required />
      )}
      <Campo etiqueta="Correo" name="correo" type="email" autoComplete="email" required />
      <Campo
        etiqueta="Contraseña"
        name="contrasena"
        type="password"
        autoComplete="new-password"
        minLength={8}
        required
        ayuda="Mínimo 8 caracteres."
      />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Button type="submit" variant={rol === "empresa" ? "primary" : "brick"} className="w-full" disabled={enviando}>
        {enviando ? "Creando cuenta…" : rol === "empresa" ? "Crear cuenta y empezar el trial" : "Crear cuenta de consultor"}
      </Button>
    </form>
  );
}
