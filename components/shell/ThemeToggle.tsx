"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

const sinSuscripcion = () => () => {};

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // Evita el desajuste de hidratación: el tema real solo se conoce en el cliente.
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const oscuro = montado && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(oscuro ? "light" : "dark")}
      title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      aria-label={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className="grid h-10 w-10 flex-none cursor-pointer place-items-center rounded-[10px] border border-line bg-surface text-ink-2 hover:text-ink"
    >
      {oscuro ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
