"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, X } from "lucide-react";
import type { Puerta } from "@/lib/rutas";

const TEXTO: Record<Puerta, string> = {
  empresa: "Tu cuenta es de empresa o entidad, así que entraste a ese portal.",
  consultor: "Tu cuenta es de consultor, así que entraste al portal de consultores.",
};

/**
 * Aviso de puerta equivocada (RF-84, CU-14 flujo 4a). El login agrega
 * `?aviso=puerta` al inicio del portal; aquí se muestra y se quita de la
 * dirección para que no reaparezca al recargar. No autoriza nada: el rol ya lo
 * comprobó el layout en el servidor.
 */
export function AvisoPuerta({ rol }: { rol: Puerta }) {
  const parametros = useSearchParams();
  const ruta = usePathname();
  const router = useRouter();
  const [visible, setVisible] = useState(() => parametros.get("aviso") === "puerta");

  useEffect(() => {
    if (parametros.get("aviso") !== "puerta") return;
    const resto = new URLSearchParams(parametros);
    resto.delete("aviso");
    const consulta = resto.toString();
    router.replace(consulta ? `${ruta}?${consulta}` : ruta, { scroll: false });
  }, [parametros, ruta, router]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className={
        rol === "empresa"
          ? "flex items-start gap-3 rounded-xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-900"
          : "flex items-start gap-3 rounded-xl border border-brick-100 bg-brick-50 px-4 py-3 text-sm text-brick-700"
      }
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1">{TEXTO[rol]}</p>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100"
        aria-label="Cerrar aviso"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
