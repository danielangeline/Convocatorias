"use client";

import { useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { Button } from "@/components/ui/Button";
import { Aviso, Campo } from "./Campo";

type Fase = "cargando" | "formulario" | "enlace_invalido";

/**
 * Destino de los enlaces de invitación y de recuperación de contraseña
 * (CU-42, RF-03). Supabase Auth devuelve la sesión en el fragmento de la URL
 * (#access_token…); aquí se instala, se define la contraseña y /login reparte
 * según el rol: un administrador sigue a /mfa.
 */
export function FormularioDefinirContrasena() {
  const [fase, setFase] = useState<Fase>("cargando");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const supabase = crearClienteNavegador();

    (async () => {
      const fragmento = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = fragmento.get("access_token");
      const refreshToken = fragmento.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error: errorSesion } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        // Los tokens no deben quedar en la barra de direcciones ni en el historial.
        window.history.replaceState(null, "", window.location.pathname);
        if (!cancelado) setFase(errorSesion ? "enlace_invalido" : "formulario");
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!cancelado) setFase(data.user ? "formulario" : "enlace_invalido");
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  async function guardar(formulario: FormData) {
    const contrasena = String(formulario.get("contrasena") ?? "");
    const confirmacion = String(formulario.get("confirmacion") ?? "");
    if (contrasena.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (contrasena !== confirmacion) return setError("Las contraseñas no coinciden.");

    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { error: errorClave } = await supabase.auth.updateUser({ password: contrasena });
    if (errorClave) {
      setEnviando(false);
      setError(
        errorClave.code === "same_password"
          ? "La contraseña nueva debe ser distinta de la anterior."
          : "No pudimos guardar la contraseña. Usa una más larga o combinada."
      );
      return;
    }
    // Navegación completa para que el servidor lea la sesión nueva.
    window.location.assign("/login");
  }

  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <KeyRound className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-ink">Define tu contraseña</h1>

      {fase === "cargando" && <p className="mt-2 text-sm text-ink-soft">Validando el enlace…</p>}

      {fase === "enlace_invalido" && (
        <div className="mt-4">
          <Aviso tipo="error">
            El enlace no es válido o ya expiró. Pide uno nuevo a quien te dio acceso.
          </Aviso>
        </div>
      )}

      {fase === "formulario" && (
        <form action={guardar} className="mt-4 space-y-4">
          <Campo etiqueta="Contraseña nueva" name="contrasena" type="password" autoComplete="new-password" minLength={8} required ayuda="Mínimo 8 caracteres." />
          <Campo etiqueta="Repite la contraseña" name="confirmacion" type="password" autoComplete="new-password" minLength={8} required />
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Guardando…" : "Guardar y continuar"}
          </Button>
        </form>
      )}
    </div>
  );
}
