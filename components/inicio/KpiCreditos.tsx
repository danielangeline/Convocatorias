"use client";

import { Sparkles } from "lucide-react";
import { useCreditos } from "@/lib/hooks";
import { KpiCard } from "@/components/viz/KpiCard";

/** Indicador de créditos de IA del inicio: lee el saldo real del store (RN-17). */
export function KpiCreditos() {
  const { suscripcion, disponibles, incluidos, extra, fechaReinicio } = useCreditos();
  if (!suscripcion) return null;
  return (
    <KpiCard
      etiqueta="Créditos de IA"
      valor={disponibles.toLocaleString("es-CO")}
      sufijo={` / ${(incluidos + extra).toLocaleString("es-CO")}`}
      nota={fechaReinicio ? "Se renuevan cada mes" : "Disponibles este periodo"}
      icono={Sparkles}
      tono="violet"
    />
  );
}
