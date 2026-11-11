"use client";

import { useCreditos, useTarifas } from "@/lib/hooks";
import { KpiCelda } from "@/components/viz/KpiCard";

/** Celda de créditos de IA del inicio: lee el saldo real del store (RN-17) y lo traduce a documentos con la tarifa real (RF-100). */
export function KpiCreditos() {
  const { suscripcion, disponibles, incluidos, extra } = useCreditos();
  const tarifaDocumento = useTarifas().generacion;
  if (!suscripcion) return null;
  const documentos = tarifaDocumento > 0 ? Math.floor(disponibles / tarifaDocumento) : 0;
  return (
    <KpiCelda
      etiqueta="Créditos de IA"
      valor={disponibles.toLocaleString("es-CO")}
      sufijo={` / ${(incluidos + extra).toLocaleString("es-CO")}`}
      nota={`Te alcanzan para ${documentos.toLocaleString("es-CO")} ${documentos === 1 ? "documento" : "documentos"}`}
      href="/suscripcion"
    />
  );
}
