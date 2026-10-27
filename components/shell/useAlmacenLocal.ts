"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENTO = "shell-almacen";

function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function suscribir(cb: () => void) {
  window.addEventListener(EVENTO, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENTO, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Preferencia por viewer en localStorage (menú contraído, grupos cerrados).
 * El servidor y la primera pintura usan `defecto`; sin localStorage la pantalla
 * funciona igual.
 */
export function useAlmacenLocal(clave: string, defecto: string): [string, (v: string) => void] {
  const valor = useSyncExternalStore(
    suscribir,
    () => leer(clave) ?? defecto,
    () => defecto
  );
  const fijar = useCallback(
    (v: string) => {
      try {
        localStorage.setItem(clave, v);
      } catch {
        /* sin almacenamiento: no se recuerda */
      }
      window.dispatchEvent(new Event(EVENTO));
    },
    [clave]
  );
  return [valor, fijar];
}
