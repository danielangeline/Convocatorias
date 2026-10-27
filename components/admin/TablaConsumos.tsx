"use client";

import { useState } from "react";
import type { ConsumoIA } from "@/lib/admin/consumo";
import { TIPO_CONSUMO_LABEL } from "@/lib/admin/consumo-etiquetas";
import { DataTable } from "@/components/ui/DataTable";
import { Tabs } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { formatFechaHora } from "@/lib/utils";

type Filtro = "todos" | "exitosos" | "fallidos";

/** RF-108 · Últimos consumos de IA, con pestañas por resultado. */
export function TablaConsumos({ consumos }: { consumos: ConsumoIA[] }) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const filas = consumos.filter((c) => filtro === "todos" || (filtro === "exitosos" ? c.exito : !c.exito));
  return (
    <div className="flex flex-col gap-3">
      <Tabs
        etiqueta="Resultado"
        valor={filtro}
        onChange={setFiltro}
        pestanas={[
          { valor: "todos", etiqueta: "Todos", conteo: consumos.length },
          { valor: "exitosos", etiqueta: "Exitosos", conteo: consumos.filter((c) => c.exito).length },
          { valor: "fallidos", etiqueta: "Fallidos (sin costo)", conteo: consumos.filter((c) => !c.exito).length },
        ]}
      />
      <DataTable
        etiqueta="Consumos de IA"
        filas={filas}
        clave={(c) => c.id}
        vacio={<p className="px-[18px] py-8 text-center text-[13px] text-ink-3">No hay consumos en esta pestaña.</p>}
        columnas={[
          { clave: "fecha", titulo: "Fecha", ancho: "150px", celda: (c) => <span className="text-ink-2">{formatFechaHora(c.fecha)}</span> },
          {
            clave: "tipo",
            titulo: "Uso",
            ancho: "minmax(0,1.3fr)",
            celda: (c) => (
              <>
                <span className="block truncate font-bold">{TIPO_CONSUMO_LABEL[c.tipo] ?? c.tipo}</span>
                <span className="block truncate text-xs text-ink-3">{c.usuario ?? "Cuenta borrada"}</span>
              </>
            ),
          },
          {
            clave: "resultado",
            titulo: "Resultado",
            ancho: "120px",
            celda: (c) =>
              c.exito ? <Badge tono="pri">Exitoso</Badge> : <Badge tono="rose">Fallido</Badge>,
          },
          {
            clave: "tokens",
            titulo: "Tokens",
            ancho: "140px",
            alinear: "derecha",
            celda: (c) => (
              <span className="font-tabular text-ink-2">
                {c.tokensEntrada === null && c.tokensSalida === null
                  ? "—"
                  : `${(c.tokensEntrada ?? 0).toLocaleString("es-CO")} / ${(c.tokensSalida ?? 0).toLocaleString("es-CO")}`}
              </span>
            ),
          },
          {
            clave: "costo",
            titulo: "Costo USD",
            ancho: "100px",
            alinear: "derecha",
            celda: (c) => (
              <span className="font-tabular font-semibold">
                {c.costoUsd === null ? "—" : `$${c.costoUsd.toLocaleString("es-CO", { maximumFractionDigits: 4 })}`}
              </span>
            ),
          },
        ]}
      />
    </div>
  );
}
