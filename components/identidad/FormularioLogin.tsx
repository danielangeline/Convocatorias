"use client";

import { useActionState } from "react";
import { iniciarSesion } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import { Aviso, Campo } from "./Campo";

export function FormularioLogin({ errorInicial }: { errorInicial?: string }) {
  const [estado, accion, enviando] = useActionState(iniciarSesion, { error: errorInicial });

  return (
    <form action={accion} className="mt-6 space-y-4">
      <Campo etiqueta="Correo" name="correo" type="email" autoComplete="email" required />
      <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="current-password" required />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Button type="submit" className="w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
