"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * RF-103 · Guardar o quitar una convocatoria desde su ficha. El servidor manda:
 * si falla, se deshace. `soloIcono` es la versión de la barra fija del móvil.
 */
export function BotonGuardar({
  convocatoriaId,
  inicial,
  soloIcono = false,
  className,
}: {
  convocatoriaId: string;
  inicial: boolean;
  soloIcono?: boolean;
  className?: string;
}) {
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

  const etiqueta = error ? "No se pudo, reintenta" : guardada ? "Guardada" : "Guardar";
  return (
    <Button
      variant="secondary"
      size="lg"
      onClick={alternar}
      disabled={ocupado}
      aria-pressed={guardada}
      aria-label={soloIcono ? (guardada ? "Quitar de guardadas" : "Guardar convocatoria") : undefined}
      className={className}
    >
      <Bookmark className={`${soloIcono ? "h-5 w-5" : "h-4 w-4"} ${guardada ? "fill-current text-pri-text" : ""}`} />
      {!soloIcono && etiqueta}
    </Button>
  );
}
