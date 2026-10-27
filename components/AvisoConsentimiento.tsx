"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * RF-88 · Las cuentas de empresa creadas antes de la sesión 021 no pasaron por
 * la casilla del registro: este aviso les pide la misma autorización.
 */
export function AvisoConsentimiento() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aceptar = async () => {
    setEnviando(true);
    setError(null);
    const r = await fetch("/api/cuenta/consentimiento", { method: "POST" });
    const json = await r.json().catch(() => ({}));
    setEnviando(false);
    if (!r.ok) return setError(json.error ?? "No pudimos registrar tu autorización. Intenta de nuevo.");
    router.refresh();
  };

  return (
    <div role="region" aria-label="Autorización de datos personales" className="mb-6 rounded-xl border border-primary-100 bg-primary-50 p-4 text-sm text-primary-900">
      <p className="flex items-center gap-1.5 font-semibold">
        <ShieldCheck className="h-4 w-4" /> Falta tu autorización de datos personales
      </p>
      <p className="mt-1 text-primary-800">
        Tu cuenta se creó antes de que pidiéramos esta autorización. Para seguir operando: autorizo el tratamiento de mis
        datos personales para crear y operar mi cuenta en la plataforma, conforme a la Ley 1581 de 2012.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-danger">
          {error}
        </p>
      )}
      <Button variant="primary" size="sm" className="mt-3" onClick={aceptar} disabled={enviando}>
        {enviando ? "Registrando…" : "Autorizo"}
      </Button>
    </div>
  );
}
