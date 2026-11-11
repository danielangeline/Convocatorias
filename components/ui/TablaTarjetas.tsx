"use client";

import { useEffect, useRef } from "react";

/**
 * Envuelve una `<table>` del panel para que, por debajo de 768 px, cada fila se
 * vea como una tarjeta: la primera celda hace de título y las demás muestran
 * «etiqueta: valor». Las etiquetas salen de los `<th>` del encabezado; el CSS
 * está en `globals.css` (`.tabla-tarjetas`). En escritorio no cambia nada.
 */
export function TablaTarjetas({ children }: { children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);

  // Se vuelve a anotar tras cada render: las filas cambian con los filtros.
  useEffect(() => {
    const tabla = caja.current?.querySelector("table");
    if (!tabla) return;
    const etiquetas = [...tabla.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
    tabla.querySelectorAll("tbody tr").forEach((fila) => {
      fila.querySelectorAll("td").forEach((celda, i) => {
        const e = etiquetas[i];
        if (e) celda.setAttribute("data-etiqueta", e);
        else celda.removeAttribute("data-etiqueta");
      });
    });
  });

  return (
    <div ref={caja} className="tabla-tarjetas">
      {children}
    </div>
  );
}
