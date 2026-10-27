"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { DataTable } from "@/components/ui/DataTable";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { KanbanBoard, type ColumnaKanban } from "@/components/viz/KanbanBoard";
import type { Tono } from "@/components/viz/tonos";
import { ESTADO_POSTULACION_ESTILO, ESTADO_POSTULACION_LABEL, ESTADO_POSTULACION_ORDEN, formatFecha } from "@/lib/utils";
import type { EstadoPostulacion } from "@/lib/types";

export interface ItemTablero {
  id: string;
  estado: EstadoPostulacion;
  nombre: string;
  entidad: string;
  proyecto: string;
  hechos: number;
  total: number;
  /** Días al cierre; nulo si la convocatoria ya no está disponible. */
  dias: number | null;
  cierre: string | null;
}

const TONO_ESTADO: Record<EstadoPostulacion, Tono> = {
  en_preparacion: "neutro",
  presentada: "sky",
  en_evaluacion: "amber",
  aprobada: "pri",
  rechazada: "rose",
  cerrada: "neutro",
};

/** CU-13 · Tablero por estado de la postulación, con vista de lista alternativa. */
export function TableroPostulaciones({ items }: { items: ItemTablero[] }) {
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const router = useRouter();

  const columnas: ColumnaKanban[] = ESTADO_POSTULACION_ORDEN.map((estado) => ({
    clave: estado,
    titulo: ESTADO_POSTULACION_LABEL[estado],
    tono: TONO_ESTADO[estado],
    tarjetas: items
      .filter((i) => i.estado === estado)
      .map((i) => ({
        id: i.id,
        entidad: i.entidad,
        nombre: i.nombre,
        proyecto: i.proyecto,
        hechos: i.hechos,
        total: i.total,
        dias: i.dias !== null && i.dias >= 0 ? i.dias : null,
      })),
  }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Segmented
          etiqueta="Vista"
          valor={vista}
          onChange={setVista}
          opciones={[
            { valor: "tablero", titulo: "Tablero", etiqueta: <LayoutGrid className="h-4 w-4" aria-label="Tablero" /> },
            { valor: "lista", titulo: "Lista", etiqueta: <List className="h-4 w-4" aria-label="Lista" /> },
          ]}
        />
      </div>

      {vista === "tablero" ? (
        <KanbanBoard
          columnas={columnas}
          renderTarjeta={(t, contenido) => (
            <Link href={`/postulaciones/${t.id}`} className="block rounded-xl outline-offset-2 hover:[&>div]:border-pri">
              {contenido}
            </Link>
          )}
        />
      ) : (
        <DataTable
          etiqueta="Postulaciones"
          filas={items}
          clave={(i) => i.id}
          alHacerClic={(i) => router.push(`/postulaciones/${i.id}`)}
          columnas={[
            {
              clave: "nombre",
              titulo: "Convocatoria",
              ancho: "minmax(0,3fr)",
              celda: (i) => (
                <>
                  <span className="block truncate font-bold">{i.nombre}</span>
                  <span className="mt-0.5 block truncate text-xs text-ink-3">
                    {i.entidad} · {i.proyecto}
                  </span>
                </>
              ),
            },
            {
              clave: "estado",
              titulo: "Estado",
              ancho: "150px",
              celda: (i) => <Badge className={ESTADO_POSTULACION_ESTILO[i.estado]}>{ESTADO_POSTULACION_LABEL[i.estado]}</Badge>,
            },
            {
              clave: "avance",
              titulo: "Checklist",
              ancho: "minmax(0,1.4fr)",
              celda: (i) => (
                <div className="flex flex-col gap-1.5">
                  <ProgressBar
                    altura={5}
                    porcentaje={i.total > 0 ? (i.hechos / i.total) * 100 : 0}
                    tono={i.total > 0 && i.hechos >= i.total ? "pri" : "sky"}
                  />
                  <span className="font-tabular text-[11.5px] text-ink-3">
                    {i.hechos}/{i.total} requisitos
                  </span>
                </div>
              ),
            },
            {
              clave: "cierre",
              titulo: "Cierre",
              ancho: "110px",
              celda: (i) => <span className="text-ink-2">{i.cierre ? formatFecha(i.cierre) : "—"}</span>,
            },
          ]}
        />
      )}
    </div>
  );
}
