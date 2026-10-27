import "server-only";
import { cache } from "react";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { sugerenciasDeProyecto, type CriterioEvaluado } from "@/lib/sugerencias";
import { diasRestantes } from "@/lib/utils";
import type { Convocatoria } from "@/lib/types";

/**
 * Compatibilidad de cada convocatoria vigente con los proyectos de la empresa
 * (CU-10, RF-15, RF-16). Es el mismo cruce determinístico de
 * `sugerencias_proyecto` (RN-05): aquí solo se queda, por convocatoria, el
 * proyecto que mejor coincide. Con la suscripción vencida la base responde 402
 * y el resultado queda vacío (RN-16). `cache` lo comparte entre el layout y la
 * página de una misma petición.
 */
export interface Compatibilidad {
  convocatoria: Convocatoria;
  porcentaje: number;
  criterios: CriterioEvaluado[];
  proyectoId: string;
  proyectoNombre: string;
}

const MAXIMO_PROYECTOS = 8;
const DIAS_NUEVA = 7;

export const compatibilidadEmpresa = cache(async (): Promise<{ porConvocatoria: Map<string, Compatibilidad>; proyectos: number }> => {
  const proyectos = await listarProyectos();
  const elegidos = proyectos.slice(0, MAXIMO_PROYECTOS);
  const resultados = await Promise.all(elegidos.map((p) => sugerenciasDeProyecto(p.id)));
  const porConvocatoria = new Map<string, Compatibilidad>();
  resultados.forEach((r, i) => {
    if (!r.ok) return;
    for (const s of r.datos.sugerencias) {
      if (diasRestantes(s.convocatoria.fechaCierre) < 0) continue;
      const actual = porConvocatoria.get(s.convocatoria.id);
      if (!actual || s.porcentaje > actual.porcentaje) {
        porConvocatoria.set(s.convocatoria.id, {
          convocatoria: s.convocatoria,
          porcentaje: s.porcentaje,
          criterios: s.criterios,
          proyectoId: elegidos[i].id,
          proyectoNombre: elegidos[i].nombre,
        });
      }
    }
  });
  return { porConvocatoria, proyectos: proyectos.length };
});

/** Compatibles publicadas en los últimos 7 días (para «nuevas esta semana» y el contador del menú). */
export function nuevasEstaSemana(compatibles: Compatibilidad[], catalogo: Convocatoria[]): number {
  const limite = Date.now() - DIAS_NUEVA * 24 * 60 * 60 * 1000;
  const publicada = new Map(catalogo.map((c) => [c.id, c.publicadaAt ?? null]));
  return compatibles.filter((c) => {
    const f = publicada.get(c.convocatoria.id);
    return f ? new Date(f).getTime() >= limite : false;
  }).length;
}
