"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { Plan, TarifasIA } from "@/lib/types";

/**
 * Entrega al store los planes activos del rol, leídos en el servidor (RF-82,
 * docs/05 §9.28), para el comparador y los modales de suscripción y créditos.
 * Reemplaza los planes de ejemplo. Como SincronizarProyectos: la primera vez
 * durante el render, después por el efecto. No autoriza nada. Desde la sesión
 * 030 entrega también las tarifas de la IA (RN-17, RF-100).
 */
export function SincronizarPlanes({ planes, tarifas }: { planes: Plan[]; tarifas: TarifasIA }) {
  useState(() => {
    useAppStore.getState().hidratarPlanes(planes);
    useAppStore.getState().hidratarTarifas(tarifas);
    return true;
  });

  const clave = JSON.stringify(planes);
  useEffect(() => {
    useAppStore.getState().hidratarPlanes(JSON.parse(clave) as Plan[]);
  }, [clave]);
  const claveTarifas = JSON.stringify(tarifas);
  useEffect(() => {
    useAppStore.getState().hidratarTarifas(JSON.parse(claveTarifas) as TarifasIA);
  }, [claveTarifas]);

  return null;
}
