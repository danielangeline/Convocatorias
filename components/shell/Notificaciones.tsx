"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import type { Notificacion } from "@/lib/notificaciones-empresa";
import { TONO_VAR } from "@/components/viz/tonos";
import { useAlmacenLocal } from "./useAlmacenLocal";

/**
 * RF-105 · Campana con los avisos calculados en el servidor. Qué avisos ya vio
 * se recuerda en este navegador (sin tabla): el punto rojo solo marca los nuevos.
 */
export function Notificaciones({ avisos }: { avisos: Notificacion[] }) {
  const [abierto, setAbierto] = useState(false);
  const [vistosRaw, fijarVistos] = useAlmacenLocal("shell:avisos-vistos", "");
  const vistos = new Set(vistosRaw.split("|").filter(Boolean));
  const nuevos = avisos.filter((a) => !vistos.has(a.id)).length;
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", esc);
    };
  }, [abierto]);

  const alternar = () => {
    const abrir = !abierto;
    setAbierto(abrir);
    // Al abrir, los avisos de ahora quedan vistos (solo los vigentes, para no crecer sin fin).
    if (abrir && nuevos > 0) fijarVistos(avisos.map((a) => a.id).join("|"));
  };

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-label={nuevos > 0 ? `Notificaciones: ${nuevos} nuevas` : "Notificaciones"}
        title="Notificaciones"
        className="relative grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[10px] border border-line bg-surface text-ink-2 hover:text-ink"
      >
        <Bell className="h-4 w-4" />
        {nuevos > 0 && (
          <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full bg-rose shadow-[0_0_0_2px_var(--surface)]" />
        )}
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-12 z-30 w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
        >
          <div className="border-b border-line px-4 py-3 text-[13px] font-extrabold">Notificaciones</div>
          {avisos.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-3">No tienes avisos por ahora.</p>
          ) : (
            <ul className="m-0 max-h-[360px] list-none overflow-y-auto p-1.5">
              {avisos.map((a) => (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    onClick={() => setAbierto(false)}
                    className="flex gap-2.5 rounded-xl px-2.5 py-2.5 text-[13px] leading-snug text-ink hover:bg-surface-2"
                  >
                    <span className="mt-1.5 h-2 w-2 flex-none rounded-full" style={{ background: TONO_VAR[a.tono] }} />
                    {a.texto}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
