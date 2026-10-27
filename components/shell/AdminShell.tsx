"use client";

import { AppShell } from "./AppShell";
import { gruposAdmin } from "./menus-admin";

/** Shell del panel con su menú propio; solo se carga en /admin (RNF-35). */
export function AdminShell({
  esPropietario,
  contadores,
  children,
}: {
  esPropietario: boolean;
  contadores: Record<string, number>;
  children: React.ReactNode;
}) {
  return (
    <AppShell rol="administrador" grupos={gruposAdmin(esPropietario)} ancho="max-w-6xl" contadores={contadores}>
      {children}
    </AppShell>
  );
}
