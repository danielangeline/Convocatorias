"use client";

import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EVENTO_ABRIR_RECORRIDO } from "@/components/recorrido/RecorridoBienvenida";

/** RF-119 · CU-51 6a: repite el recorrido de bienvenida desde el principio. */
export function VerRecorrido() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="text-sm font-semibold">Recorrido de bienvenida</div>
        <div className="text-xs text-ink-3">Te mostramos otra vez para qué sirve cada sección.</div>
      </div>
      <Button variant="secondary" onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_RECORRIDO))}>
        <Compass className="h-4 w-4" /> Ver el recorrido
      </Button>
    </div>
  );
}
