"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Plan } from "@/lib/types";

/**
 * Entrega al store los planes activos del rol, leídos en el servidor (RF-82,
 * docs/05 §9.28), para el comparador y los modales de suscripción y créditos.
 * Reemplaza los planes de ejemplo. Como SincronizarProyectos: la primera vez
 * durante el render, después por el efecto. No autoriza nada.
 */
export function SincronizarPlanes({ planes }: { planes: Plan[] }) {
  useState(() => {
    useAppStore.getState().hidratarPlanes(planes);
    return true;
  });

  const clave = JSON.stringify(planes);
  useEffect(() => {
    useAppStore.getState().hidratarPlanes(JSON.parse(clave) as Plan[]);
  }, [clave]);

  return null;
}
