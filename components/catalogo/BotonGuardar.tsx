"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** RF-103 · Guardar o quitar una convocatoria desde su ficha. El servidor manda: si falla, se deshace. */
export function BotonGuardar({ convocatoriaId, inicial }: { convocatoriaId: string; inicial: boolean }) {
  const [guardada, setGuardada] = useState(inicial);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(false);

  const alternar = async () => {
    const antes = guardada;
    setOcupado(true);
    setError(false);
    setGuardada(!antes);
    const r = await fetch(antes ? `/api/guardadas/${convocatoriaId}` : "/api/guardadas", {
      method: antes ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: antes ? undefined : JSON.stringify({ convocatoriaId }),
    }).catch(() => null);
    setOcupado(false);
    if (!r?.ok) {
      setGuardada(antes);
      setError(true);
    }
  };

  return (
    <Button variant="secondary" size="lg" onClick={alternar} disabled={ocupado} aria-pressed={guardada}>
      <Bookmark className={guardada ? "h-4 w-4 fill-current text-pri-text" : "h-4 w-4"} />
      {error ? "No se pudo, reintenta" : guardada ? "Guardada" : "Guardar"}
    </Button>
  );
}
