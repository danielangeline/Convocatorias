"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { registrarse } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import type { Puerta } from "@/lib/rutas";
import { Aviso, Campo } from "./Campo";
import { SelectorPuerta } from "./SelectorPuerta";

const DETALLE: Record<Puerta, string> = {
  empresa: "Busque convocatorias y prepare postulaciones. Prueba gratis 7 días con créditos de IA incluidos.",
  consultor: "Ofrezca sus servicios. Su perfil pasa por revisión antes de publicarse.",
};

// CU-14, RF-01, RF-84: la puerta fija el rol. El administrador no se elige
// aquí: solo nace de una invitación del Propietario (RN-06, RN-32).
export function FormularioRegistro({ puertaInicial }: { puertaInicial: Puerta }) {
  const [rol, setRol] = useState<Puerta>(puertaInicial);
  const [estado, accion, enviando] = useActionState(registrarse, {});
  const [consiente, setConsiente] = useState(false);
  const [correo, setCorreo] = useState("");

  if (estado.mensaje) {
    return (
      <div className="mt-8 flex flex-col items-center gap-3 text-center" role="status">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pri-soft text-pri-text">
          <MailCheck className="h-6 w-6" />
        </span>
        <p className="font-display text-xl font-semibold text-ink">Revise su correo</p>
        {correo && (
          <p className="text-[15px] text-ink-2">
            Enviamos el enlace de confirmación a <strong className="font-bold text-ink">{correo}</strong>.
          </p>
        )}
        <p className="text-sm text-ink-2">{estado.mensaje}</p>
      </div>
    );
  }

  return (
    <form
      action={accion}
      onSubmit={(e) => setCorreo(String(new FormData(e.currentTarget).get("correo") ?? ""))}
      className="mt-6 space-y-4"
    >
      <SelectorPuerta puerta={rol} onCambio={setRol} detalle={DETALLE} />

      <Campo etiqueta="Su nombre" name="nombre" autoComplete="name" required />
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
      {/* RF-88: sin marcar por defecto; el servidor la vuelve a exigir. */}
      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-ink-2">
        <input
          type="checkbox"
          name="consentimiento_datos"
          value="si"
          required
          checked={consiente}
          onChange={(e) => setConsiente(e.target.checked)}
          className="mt-px h-[22px] w-[22px] shrink-0 cursor-pointer rounded-[4px] border-line-strong accent-pri"
        />
        <span>
          Autorizo el tratamiento de mis datos personales para crear y operar mi cuenta en la plataforma, conforme a la
          Ley 1581 de 2012.
        </span>
      </label>
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      {/* Atenuado hasta marcar la autorización; sigue activo para que el navegador la pida (RF-88). */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className={`w-full ${consiente ? "" : "opacity-50"}`}
        disabled={enviando}
      >
        {enviando ? "Creando cuenta…" : rol === "empresa" ? "Crear cuenta y empezar la prueba" : "Crear cuenta de consultor"}
      </Button>
      {rol === "empresa" && (
        <p className="text-center text-[13px] text-ink-3">Prueba gratuita de 7 días. Sin tarjeta de crédito.</p>
      )}
    </form>
  );
}
