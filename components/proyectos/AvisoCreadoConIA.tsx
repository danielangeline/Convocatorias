"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

const sinSuscripcion = () => () => {};

function leerFaltantes(id: string): string {
  try {
    return sessionStorage.getItem(`proyecto-ia:${id}`) ?? "[]";
  } catch {
    return "[]";
  }
}

/**
 * CU-43, RF-98, RN-37 · Aviso de la ficha de un proyecto recién creado con IA:
 * qué es, qué faltó (lo que la explicación no dijo) y el paso siguiente.
 */
export function AvisoCreadoConIA({ proyectoId }: { proyectoId: string }) {
  const router = useRouter();
  const crudo = useSyncExternalStore(sinSuscripcion, () => leerFaltantes(proyectoId), () => "[]");
  let faltantes: string[] = [];
  try {
    const leido = JSON.parse(crudo);
    if (Array.isArray(leido)) faltantes = leido.filter((x): x is string => typeof x === "string");
  } catch {
    /* lista ilegible: se omite */
  }

  const cerrar = () => {
    try {
      sessionStorage.removeItem(`proyecto-ia:${proyectoId}`);
    } catch {
      /* nada que borrar */
    }
    router.replace(`/proyectos/${proyectoId}`, { scroll: false });
  };

  return (
    <div
      role="status"
      className="relative mb-5 rounded-2xl border border-violet/30 bg-violet/10 p-5 pr-12"
    >
      <button
        type="button"
        onClick={cerrar}
        aria-label="Cerrar el aviso"
        className="absolute right-3 top-3 grid h-9 w-9 cursor-pointer place-items-center rounded-[10px] text-ink-3 hover:bg-surface hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
      <p className="flex items-center gap-2 text-[15px] font-extrabold text-violet-ink">
        <Sparkles className="h-4 w-4" /> Creamos tu proyecto con IA
      </p>
      <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-2">
        Lo armamos solo con lo que contaste. Revisa cada parte y edítala con su lápiz; nada se envía a ninguna
        entidad desde aquí.
      </p>
      {faltantes.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-[.07em] text-ink-3">Lo que no dijiste y conviene completar</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {faltantes.map((f) => (
              <li key={f} className="rounded-full bg-amber/15 px-2.5 py-1 text-xs font-semibold text-amber-ink">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/proyectos/${proyectoId}/sugerencias`}>
          <Button size="sm">
            Ver convocatorias que le sirven <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
