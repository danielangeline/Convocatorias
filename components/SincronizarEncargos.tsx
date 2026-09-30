"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Encargo } from "@/lib/types";

/**
 * Entrega al store los encargos que el layout leyó en el servidor con la
 * sesión de la empresa (RN-30, Sprint 4 paso 3), para las pantallas que aún
 * leen del store (la ficha del proyecto y documentos). Como
 * SincronizarPostulaciones. No autoriza nada.
 */
export function SincronizarEncargos({ encargos }: { encargos: Encargo[] }) {
  useState(() => {
    useAppStore.getState().hidratarEncargos(encargos);
    return true;
  });

  const clave = JSON.stringify(encargos);
  useEffect(() => {
    useAppStore.getState().hidratarEncargos(JSON.parse(clave) as Encargo[]);
  }, [clave]);

  return null;
}
