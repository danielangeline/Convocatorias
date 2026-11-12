import "server-only";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { funcionesDeFila } from "@/lib/planes";
import type { FuncionPlan, PlanEfectivo } from "@/lib/types";

/**
 * RN-41, RF-40, RF-120 · Funciones por plan en el servidor (docs/05 §9.38).
 *
 * La base es la barrera: cada función que ejerce una función del plan rechaza
 * con `funcion_no_incluida`, y la RLS de postulaciones, checklist y
 * calificaciones exige `privado.sesion_incluye`. Aquí se pregunta antes donde
 * la RLS, por sí sola, respondería «no existe» (una fila filtrada) en lugar de
 * «su plan no la incluye».
 */

export const MENSAJE_FUNCION: Record<FuncionPlan, string> = {
  proyecto_ia:
    "Su plan no incluye crear ni editar proyectos con IA. Está disponible desde el plan Esencial; puede llenar el formulario a mano.",
  sugerencias: "Su plan no incluye las sugerencias por compatibilidad. Están disponibles desde el plan Esencial.",
  documento_ia: "Su plan no incluye el documento base con IA ni sus ajustes. Está disponible desde el plan Esencial.",
  postulaciones:
    "Su plan no incluye las postulaciones: puede ver y descargar las que ya tiene, pero no crear nuevas ni avanzarlas. Están disponibles desde el plan Esencial.",
  consultores:
    "Su plan no incluye el trabajo con consultores: puede ver sus encargos, pero no solicitar nuevos, elegir propuestas, calificar ni compartir documentos. Está disponible en el plan Pro.",
};

/** El rechazo HTTP de una función no incluida (402, como la falta de créditos). */
export const rechazoFuncion = (f: FuncionPlan) => ({ status: 402, error: MENSAJE_FUNCION[f] });

/** El plan efectivo de la sesión, con la regla de la base (`mi_plan_efectivo()`). Null si no es empresa. */
export const planEfectivoSesion = cache(async (): Promise<PlanEfectivo | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("mi_plan_efectivo").maybeSingle();
  if (error) {
    console.error("Plan efectivo: no se pudo leer", error.code, error.message);
    return null;
  }
  const f = data as { plan_id: string; nombre: string; es_gratuito: boolean } | null;
  if (!f) return null;
  return { planId: f.plan_id, nombre: f.nombre, esGratuito: f.es_gratuito === true, funciones: funcionesDeFila(f) };
});

/** Null si el plan de la sesión incluye la función; si no, el rechazo listo para responder. */
export async function exigirFuncion(f: FuncionPlan): Promise<{ ok: false; status: number; error: string } | null> {
  const plan = await planEfectivoSesion();
  if (plan?.funciones[f]) return null;
  return { ok: false, ...rechazoFuncion(f) };
}
