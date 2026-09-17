"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { pedirRecuperacion } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import { Aviso, Campo } from "./Campo";

// RF-03: pide el enlace de recuperación. La respuesta no revela si la cuenta existe.
export function FormularioRecuperar() {
  const [estado, accion, enviando] = useActionState(pedirRecuperacion, {});

  if (estado.mensaje) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3 text-center" role="status">
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
      <Campo etiqueta="Correo" name="correo" type="email" autoComplete="email" required />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Enviando…" : "Enviar enlace"}
      </Button>
    </form>
  );
}
