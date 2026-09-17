"use client";

import { useActionState, useState } from "react";
import { iniciarSesion } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import type { Puerta } from "@/lib/rutas";
import { Aviso, Campo } from "./Campo";
import { SelectorPuerta } from "./SelectorPuerta";

// CU-14, RF-84: la puerta solo orienta; la cuenta entra al portal de su rol.
export function FormularioLogin({ puertaInicial, errorInicial }: { puertaInicial: Puerta; errorInicial?: string }) {
  const [puerta, setPuerta] = useState<Puerta>(puertaInicial);
  const [estado, accion, enviando] = useActionState(iniciarSesion, { error: errorInicial });

  return (
    <form action={accion} className="mt-6 space-y-4">
      <SelectorPuerta puerta={puerta} onCambio={setPuerta} />
      <Campo etiqueta="Correo" name="correo" type="email" autoComplete="email" required />
      <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="current-password" required />
      {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
      <Button type="submit" variant={puerta === "empresa" ? "primary" : "brick"} className="w-full" disabled={enviando}>
        {enviando ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
