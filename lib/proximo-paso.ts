import type { PostulacionConConvocatoria } from "@/lib/types";
import { diasRestantes } from "@/lib/utils";

/**
 * «Tu próximo paso» del Inicio (CU-44, RF-101): una sola acción, calculada con
 * lo que la empresa ya tiene. No inventa nada: sale de sus postulaciones, sus
 * proyectos y las sugeridas del cruce determinístico (RN-05).
 *
 * Prioridad: la postulación en preparación con el cierre más cercano y
 * requisitos pendientes; si no hay, registrar el primer proyecto; si no, revisar
 * las sugeridas; si no hay ninguna, no hay paso que proponer.
 */
export type ProximoPaso =
  | {
      tipo: "completar_postulacion";
      postulacionId: string;
      convocatoriaId: string;
      convocatoria: string;
      pendientes: number;
      total: number;
      /** Hasta tres requisitos pendientes, para el texto «a, b y c». */
      nombresPendientes: string[];
      dias: number;
      fechaCierre: string;
    }
  | { tipo: "registrar_proyecto" }
  | { tipo: "revisar_sugeridas"; cantidad: number };

export function proximoPaso(
  postulaciones: PostulacionConConvocatoria[],
  proyectos: number,
  sugeridas: number
): ProximoPaso | null {
  const candidatas = postulaciones
    .filter((p) => p.estado === "en_preparacion" && p.convocatoria && diasRestantes(p.convocatoria.fechaCierre) >= 0)
    .map((p) => ({ p, pendientes: p.checklist.filter((i) => !i.completado) }))
    .filter((x) => x.pendientes.length > 0)
    .sort((a, b) => a.p.convocatoria!.fechaCierre.localeCompare(b.p.convocatoria!.fechaCierre));

  const primera = candidatas[0];
  if (primera) {
    const c = primera.p.convocatoria!;
    return {
      tipo: "completar_postulacion",
      postulacionId: primera.p.id,
      convocatoriaId: c.id,
      convocatoria: c.nombre,
      pendientes: primera.pendientes.length,
      total: primera.p.checklist.length,
      nombresPendientes: primera.pendientes.slice(0, 3).map((i) => abreviar(i.descripcion)),
      dias: diasRestantes(c.fechaCierre),
      fechaCierre: c.fechaCierre,
    };
  }
  if (proyectos === 0) return { tipo: "registrar_proyecto" };
  if (sugeridas > 0) return { tipo: "revisar_sugeridas", cantidad: sugeridas };
  return null;
}

/** Los requisitos son frases largas: para el resumen se recortan a ~60 caracteres, en el límite de una palabra. */
function abreviar(texto: string, max = 60): string {
  const t = texto.trim().replace(/[.;:,]+$/, "");
  if (t.length <= max) return t;
  const corte = t.slice(0, max).replace(/\s+\S*$/, "");
  return `${corte}…`;
}

/** «a», «a y b», «a, b y c». */
export function listaConY(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}
