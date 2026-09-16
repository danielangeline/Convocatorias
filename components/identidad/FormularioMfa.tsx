"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { crearClienteNavegador } from "@/lib/supabase/cliente";
import { confirmarMfa, registrarMfaFallido } from "@/lib/acciones/auth";
import { Button } from "@/components/ui/Button";
import { Aviso } from "./Campo";

type Estado =
  | { fase: "cargando" }
  | { fase: "enrolar"; factorId: string; qr: string; secreto: string }
  | { fase: "verificar"; factorId: string }
  | { fase: "fallo"; mensaje: string };

/**
 * Enrolamiento TOTP o verificación del segundo factor contra Supabase Auth
 * (CU-38). Al verificar, la sesión sube a aal2 y el servidor lo comprueba antes
 * de marcar el perfil y abrir el panel (confirmarMfa).
 */
export function FormularioMfa() {
  const [estado, setEstado] = useState<Estado>({ fase: "cargando" });
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const supabase = crearClienteNavegador();

    (async () => {
      const { data, error: errorFactores } = await supabase.auth.mfa.listFactors();
      if (errorFactores) {
        if (!cancelado) setEstado({ fase: "fallo", mensaje: "No pudimos consultar tus factores de verificación." });
        return;
      }

      const verificado = data.totp[0];
      if (verificado) {
        if (!cancelado) setEstado({ fase: "verificar", factorId: verificado.id });
        return;
      }

      // Un enrolamiento a medias bloquea uno nuevo: se descarta antes de empezar.
      for (const factor of data.all) {
        if (factor.factor_type === "totp" && factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data: alta, error: errorAlta } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Autenticador",
      });
      if (cancelado) return;
      if (errorAlta || !alta) {
        setEstado({ fase: "fallo", mensaje: "No pudimos iniciar la activación. Recarga la página." });
        return;
      }
      setEstado({ fase: "enrolar", factorId: alta.id, qr: alta.totp.qr_code, secreto: alta.totp.secret });
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  async function verificar(e: React.FormEvent) {
    e.preventDefault();
    if (estado.fase !== "enrolar" && estado.fase !== "verificar") return;
    if (codigo.length !== 6) {
      setError("Escribe los 6 dígitos que muestra tu aplicación.");
      return;
    }

    setEnviando(true);
    setError(null);
    const supabase = crearClienteNavegador();
    const { error: errorVerificacion } = await supabase.auth.mfa.challengeAndVerify({
      factorId: estado.factorId,
      code: codigo,
    });

    if (errorVerificacion) {
      await registrarMfaFallido();
      setEnviando(false);
      setCodigo("");
      setError("El código no es correcto o ya expiró. Intenta con el siguiente.");
      return;
    }

    // Redirige a /admin si el servidor confirma aal2.
    const resultado = await confirmarMfa();
    if (resultado?.error) {
      setEnviando(false);
      setError(resultado.error);
    }
  }

  return (
    <div>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-50 text-primary-700">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-ink">Verificación en dos pasos</h1>

      {estado.fase === "cargando" && <p className="mt-2 text-sm text-ink-soft">Preparando la verificación…</p>}
      {estado.fase === "fallo" && (
        <div className="mt-4">
          <Aviso tipo="error">{estado.mensaje}</Aviso>
        </div>
      )}

      {estado.fase === "enrolar" && (
        <>
          <p className="mt-2 text-sm text-ink-soft">
            Ninguna sesión administrativa opera sin un segundo factor. Escanea este código con tu aplicación
            autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…) y escribe el código que genera.
          </p>
          <div className="mt-4 flex justify-center rounded-xl border border-line bg-white p-4">
            {/* El QR llega como data URL SVG desde Supabase Auth. */}
            <img src={estado.qr} alt="Código QR para la aplicación autenticadora" className="h-44 w-44" />
          </div>
          <p className="mt-2 break-all text-center text-xs text-ink-faint">
            ¿No puedes escanear? Clave: <span className="font-tabular text-ink-soft">{estado.secreto}</span>
          </p>
        </>
      )}

      {estado.fase === "verificar" && (
        <p className="mt-2 text-sm text-ink-soft">Escribe el código de 6 dígitos de tu aplicación autenticadora.</p>
      )}

      {(estado.fase === "enrolar" || estado.fase === "verificar") && (
        <form onSubmit={verificar} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Código de 6 dígitos
            </span>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              className="w-full rounded-lg border border-line px-3 py-2 text-center font-tabular text-lg tracking-[0.3em] outline-none focus:border-primary-500"
            />
          </label>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? "Verificando…" : estado.fase === "enrolar" ? "Activar y continuar" : "Verificar y continuar"}
          </Button>
        </form>
      )}
    </div>
  );
}
