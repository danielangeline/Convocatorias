"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { registrarse } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import type { Puerta } from "@/lib/rutas";
import { Aviso, Campo } from "./Campo";
import { SelectorPuerta } from "./SelectorPuerta";

const DETALLE: Record<Puerta, string> = {
  empresa: "Busca convocatorias y prepara postulaciones. Prueba gratis 7 días con 3 créditos de IA.",
  consultor: "Ofrece tus servicios. Tu perfil pasa por revisión antes de publicarse.",
};

// CU-14, RF-01, RF-84: la puerta fija el rol. El administrador no se elige
// aquí: solo nace de una invitación del Propietario (RN-06, RN-32).
export function FormularioRegistro({ puertaInicial }: { puertaInicial: Puerta }) {
  const [rol, setRol] = useState<Puerta>(puertaInicial);
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
      <SelectorPuerta puerta={rol} onCambio={setRol} detalle={DETALLE} />

      <Campo etiqueta="Tu nombre" name="nombre" autoComplete="name" required />
      {rol === "empresa" && (
        <Campo etiqueta="Nombre de la empresa o entidad" name="nombre_empresa" autoComplete="organization" required />
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
