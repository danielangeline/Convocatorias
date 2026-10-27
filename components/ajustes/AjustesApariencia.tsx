"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { Button } from "@/components/ui/Button";

const sinSuscripcion = () => () => {};
const CLAVES_MENU = ["shell:contraido", "shell:empresa:grupos-cerrados", "shell:avisos-vistos"];

/** RF-107 · Preferencias de este navegador: tema y estado del menú. No tocan la cuenta. */
export function AjustesApariencia() {
  const { theme, setTheme } = useTheme();
  const montado = useSyncExternalStore(sinSuscripcion, () => true, () => false);
  const valor = (montado ? theme : "system") as "light" | "dark" | "system";

  const restablecerMenu = () => {
    for (const k of CLAVES_MENU) {
      try {
        localStorage.removeItem(k);
      } catch {
        /* sin almacenamiento: nada que borrar */
      }
    }
    window.dispatchEvent(new Event("shell-almacen"));
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[13.5px] font-bold">Tema</div>
          <div className="text-xs text-ink-3">«Sistema» sigue la preferencia de tu equipo.</div>
        </div>
        <Segmented
          etiqueta="Tema"
          valor={valor}
          onChange={(v) => setTheme(v)}
          opciones={[
            { valor: "light", etiqueta: <><Sun className="h-4 w-4" />Claro</> },
            { valor: "dark", etiqueta: <><Moon className="h-4 w-4" />Oscuro</> },
            { valor: "system", etiqueta: <><Monitor className="h-4 w-4" />Sistema</> },
          ]}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 pt-5">
        <div>
          <div className="text-[13.5px] font-bold">Menú lateral</div>
          <div className="text-xs text-ink-3">Vuelve a abrir todos los grupos y a expandir el menú.</div>
        </div>
        <Button variant="secondary" onClick={restablecerMenu}>
          Restablecer
        </Button>
      </div>
    </div>
  );
}
