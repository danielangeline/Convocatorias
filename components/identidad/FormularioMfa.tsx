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
        if (!cancelado) setEstado({ fase: "fallo", mensaje: "No pudimos consultar sus factores de verificación." });
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
        setEstado({ fase: "fallo", mensaje: "No pudimos iniciar la activación. Recargue la página." });
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
      setError("Escriba los 6 dígitos que muestra su aplicación.");
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
      setError("El código no es correcto o ya expiró. Intente con el siguiente.");
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
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-pri-soft text-pri-text">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.01em] text-ink">Verificación en dos pasos</h1>

      {estado.fase === "cargando" && <p className="mt-2 text-sm text-ink-2">Preparando la verificación…</p>}
      {estado.fase === "fallo" && (
        <div className="mt-4">
          <Aviso tipo="error">{estado.mensaje}</Aviso>
        </div>
      )}

      {estado.fase === "enrolar" && (
        <>
          <p className="mt-2 text-sm text-ink-2">
            Ninguna sesión administrativa opera sin un segundo factor. Escanee este código con su aplicación
            autenticadora (Google Authenticator, Microsoft Authenticator, 1Password…) y escriba el código que genera.
          </p>
          <div className="mt-4 flex justify-center rounded-md border border-line bg-surface p-4">
            {/* El QR llega como data URL SVG desde Supabase Auth. */}
            <img src={estado.qr} alt="Código QR para la aplicación autenticadora" className="h-44 w-44" />
          </div>
          <p className="mt-2 break-all text-center text-xs text-ink-3">
            ¿No puede escanear? Clave: <span className="font-tabular text-ink-2">{estado.secreto}</span>
          </p>
        </>
      )}

      {estado.fase === "verificar" && (
        <p className="mt-2 text-sm text-ink-2">Escriba el código de 6 dígitos de su aplicación autenticadora.</p>
      )}

      {(estado.fase === "enrolar" || estado.fase === "verificar") && (
        <form onSubmit={verificar} className="mt-4 space-y-3">
          <div>
            <span id="mfa-etiqueta" className="mb-1.5 block text-[13px] font-semibold text-ink">
              Código de 6 dígitos
            </span>
            {/* El input real (invisible) recibe el teclado, el pegado y el autocompletado; las 6 casillas solo lo muestran. */}
            <div className="relative">
              <div className="grid grid-cols-6 gap-2" aria-hidden>
                {Array.from({ length: 6 }, (_, i) => {
                  const actual = i === Math.min(codigo.length, 5);
                  return (
                    <div
                      key={i}
                      className={`font-tabular grid h-14 place-items-center rounded-[4px] border bg-surface text-2xl font-medium text-ink ${
                        actual ? "border-2 border-pri" : "border-line-strong"
                      }`}
                    >
                      {codigo[i] ?? ""}
                    </div>
                  );
                })}
              </div>
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                aria-labelledby="mfa-etiqueta"
                className="absolute inset-0 h-full w-full cursor-text opacity-0"
              />
            </div>
          </div>
          {error && <Aviso tipo="error">{error}</Aviso>}
          <Button type="submit" size="lg" className="w-full" disabled={enviando}>
            {enviando ? "Verificando…" : estado.fase === "enrolar" ? "Activar y continuar" : "Verificar y continuar"}
          </Button>
        </form>
      )}
    </div>
  );
}
