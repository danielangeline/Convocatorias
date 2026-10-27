import type { EstadoPostulacion, HistorialItem } from "./types";

/**
 * RF-104 · Etapa del tablero de postulaciones. Es una **vista** sobre los
 * estados reales (RF-83), que no cambian: mientras la postulación está en
 * preparación, la etapa sale del avance de su checklist; desde que se presenta
 * en el portal de la entidad (RN-19), es «Radicada». Las rechazadas, aprobadas
 * y cerradas se muestran aparte.
 */
export type EtapaPostulacion = "preparacion" | "documentos" | "lista" | "radicada" | "resuelta";

export const ETAPAS_TABLERO: EtapaPostulacion[] = ["preparacion", "documentos", "lista", "radicada", "resuelta"];

export const ETAPA_LABEL: Record<EtapaPostulacion, string> = {
  preparacion: "En preparación",
  documentos: "Documentos",
  lista: "Lista para radicar",
  radicada: "Radicada",
  resuelta: "Resuelta o cerrada",
};

/** Desde la mitad de los requisitos hechos, la postulación está reuniendo documentos. */
const UMBRAL_DOCUMENTOS = 0.5;

export function etapaDe(estado: EstadoPostulacion, hechos: number, total: number): EtapaPostulacion {
  if (estado === "presentada" || estado === "en_evaluacion") return "radicada";
  if (estado !== "en_preparacion") return "resuelta";
  if (total > 0 && hechos >= total) return "lista";
  if (total > 0 && hechos / total >= UMBRAL_DOCUMENTOS) return "documentos";
  return "preparacion";
}

/** Fecha en que pasó a presentada (la radicación), según su historial. */
export function fechaRadicacion(historial: HistorialItem[]): string | null {
  const h = historial.filter((x) => x.estadoNuevo === "presentada").sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  return h?.fecha ?? null;
}
