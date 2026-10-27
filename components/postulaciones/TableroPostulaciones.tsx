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
import { ETAPAS_TABLERO, ETAPA_LABEL, type EtapaPostulacion } from "@/lib/etapas-postulacion";
import { ESTADO_POSTULACION_ESTILO, ESTADO_POSTULACION_LABEL, formatFecha } from "@/lib/utils";
import type { EstadoPostulacion } from "@/lib/types";

export interface ItemTablero {
  id: string;
  estado: EstadoPostulacion;
  etapa: EtapaPostulacion;
  nombre: string;
  entidad: string;
  proyecto: string;
  hechos: number;
  total: number;
  /** Días al cierre; nulo si la convocatoria ya no está disponible. */
  dias: number | null;
  cierre: string | null;
  /** Días desde que se radicó (RN-19: en el portal de la entidad). */
  radicadaHace: number | null;
  consultor: string | null;
}

const TONO_ETAPA: Record<EtapaPostulacion, Tono> = {
  preparacion: "neutro",
  documentos: "sky",
  lista: "amber",
  radicada: "pri",
  resuelta: "neutro",
};

/** CU-13, RF-104 · Tablero por etapa (vista sobre los estados reales) y lista alternativa. */
export function TableroPostulaciones({ items }: { items: ItemTablero[] }) {
  const [vista, setVista] = useState<"tablero" | "lista">("tablero");
  const router = useRouter();

  const columnas: ColumnaKanban[] = ETAPAS_TABLERO.filter(
    (e) => e !== "resuelta" || items.some((i) => i.etapa === "resuelta")
  ).map((etapa) => ({
    clave: etapa,
    titulo: ETAPA_LABEL[etapa],
    tono: TONO_ETAPA[etapa],
    tarjetas: items
      .filter((i) => i.etapa === etapa)
      .map((i) => ({
        id: i.id,
        entidad: i.entidad,
        nombre: i.nombre,
        proyecto: i.proyecto,
        hechos: i.hechos,
        total: i.total,
        dias: i.dias !== null && i.dias >= 0 && i.etapa !== "resuelta" ? i.dias : null,
        consultor: i.consultor ?? undefined,
        nota:
          i.etapa === "radicada" && i.radicadaHace !== null
            ? i.radicadaHace === 0
              ? "Radicada hoy"
              : `Radicada hace ${i.radicadaHace} d`
            : i.etapa === "resuelta"
              ? ESTADO_POSTULACION_LABEL[i.estado]
              : undefined,
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
            <Link href={`/postulaciones/${t.id}`} className="block rounded-xl hover:[&>div]:border-pri">
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
              clave: "etapa",
              titulo: "Etapa",
              ancho: "150px",
              celda: (i) => <span className="font-semibold text-ink-2">{ETAPA_LABEL[i.etapa]}</span>,
            },
            {
              clave: "estado",
              titulo: "Estado",
              ancho: "140px",
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
