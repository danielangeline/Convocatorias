"use client";

import { formatCOPCorto } from "@/lib/utils";

/**
 * RF-44: la cifra real tiene que ser legible desde el primer fotograma. La
 * versión anterior contaba desde 0 durante 1,2 s, así que la primera lectura
 * —la que capturan las vistas previas y quien solo echa un vistazo— mostraba
 * un número falso. Ahora el valor se pinta correcto de entrada y la vida
 * visual la pone una entrada suave, que además respeta `prefers-reduced-motion`.
 */
export function ContadorAnimado({
  valor,
  prefijo = "",
  sufijo = "",
  variante = "entero",
}: {
  valor: number;
  prefijo?: string;
  sufijo?: string;
  variante?: "entero" | "cop-corto";
}) {
  return (
    <span className="animar-entrada font-tabular font-display text-2xl font-bold text-pri-text">
      {prefijo}
      {variante === "cop-corto" ? formatCOPCorto(valor) : valor.toLocaleString("es-CO")}
      {sufijo}
    </span>
  );
}
