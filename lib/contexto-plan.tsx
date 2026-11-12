"use client";

import { createContext } from "react";
import type { Plan, PlanEfectivo } from "./types";

/**
 * RN-41, RF-120 (sesión 042) · El plan efectivo de la empresa y los planes de su
 * rol, entregados por el layout del portal en cada petición.
 *
 * Por qué un contexto y no el store: el store de Zustand es un módulo único en
 * el proceso del servidor, así que durante el render del servidor no tiene la
 * sesión de quien pide (tiene la de ejemplo o la de otra petición) y una
 * pantalla bloqueada saldría abierta hasta hidratar. El contexto vive en el
 * árbol de esa petición. Solo informa: decide el servidor.
 */
export interface ValorContextoPlan {
  planEfectivo: PlanEfectivo | null;
  planes: Plan[];
}

export const ContextoPlan = createContext<ValorContextoPlan | null>(null);

export function ProveedorPlan({ valor, children }: { valor: ValorContextoPlan; children: React.ReactNode }) {
  return <ContextoPlan.Provider value={valor}>{children}</ContextoPlan.Provider>;
}
