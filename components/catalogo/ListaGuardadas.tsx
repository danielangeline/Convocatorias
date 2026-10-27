"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Categoria, Convocatoria } from "@/lib/types";
import { ConvocatoriaCard } from "@/components/ConvocatoriaCard";

/** RF-103 · Rejilla de guardadas: quitar una la saca de la lista y del servidor. */
export function ListaGuardadas({
  convocatorias,
  categorias,
  compatibilidad,
}: {
  convocatorias: Convocatoria[];
  categorias: Categoria[];
  compatibilidad: Record<string, number>;
}) {
  const router = useRouter();
  const [quitadas, setQuitadas] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const quitar = async (id: string) => {
    setError(null);
    setQuitadas((p) => new Set(p).add(id));
    const r = await fetch(`/api/guardadas/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) {
      setQuitadas((p) => {
        const n = new Set(p);
        n.delete(id);
        return n;
      });
      setError("No pudimos quitarla de tus guardadas. Inténtalo otra vez.");
      return;
    }
    router.refresh();
  };

  return (
    <>
      {error && (
        <p role="alert" className="rounded-lg bg-rose/10 px-4 py-3 text-sm text-rose-ink">
          {error}
        </p>
      )}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {convocatorias
          .filter((c) => !quitadas.has(c.id))
          .map((c) => (
            <ConvocatoriaCard
              key={c.id}
              convocatoria={c}
              categorias={categorias}
              compatibilidad={compatibilidad[c.id]}
              guardada
              onGuardar={() => quitar(c.id)}
            />
          ))}
      </div>
    </>
  );
}
