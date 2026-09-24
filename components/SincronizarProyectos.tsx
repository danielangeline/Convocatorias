"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Proyecto } from "@/lib/types";

/**
 * Entrega al store los proyectos que el layout leyó en el servidor con la
 * sesión de la empresa (RN-30, Sprint 3 paso 1), para las pantallas que aún
 * leen del store. Como SincronizarCatalogo: la primera vez durante el render,
 * después por el efecto (tras router.refresh). No autoriza nada.
 */
export function SincronizarProyectos({ proyectos }: { proyectos: Proyecto[] }) {
  useState(() => {
    useAppStore.getState().hidratarProyectos(proyectos);
    return true;
  });

  const clave = JSON.stringify(proyectos);
  useEffect(() => {
    useAppStore.getState().hidratarProyectos(JSON.parse(clave) as Proyecto[]);
  }, [clave]);

  return null;
}
