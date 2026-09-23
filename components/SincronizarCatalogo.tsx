"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Categoria, Convocatoria } from "@/lib/types";

/**
 * Entrega al store del cliente el catálogo que el layout leyó en el servidor
 * con la sesión de la empresa (RN-33, Sprint 2 paso 4). Como SincronizarSesion:
 * la primera vez durante el render, para que ninguna pantalla se pinte con los
 * datos de ejemplo; después, por el efecto. No autoriza nada: lo que llega ya
 * pasó por la RLS.
 */
export function SincronizarCatalogo({ convocatorias, categorias }: { convocatorias: Convocatoria[]; categorias: Categoria[] }) {
  useState(() => {
    useAppStore.getState().hidratarCatalogo(convocatorias, categorias);
    return true;
  });

  const clave = JSON.stringify([convocatorias, categorias]);
  useEffect(() => {
    const [c, k] = JSON.parse(clave) as [Convocatoria[], Categoria[]];
    useAppStore.getState().hidratarCatalogo(c, k);
  }, [clave]);

  return null;
}
