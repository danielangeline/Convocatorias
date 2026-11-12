// Sesión 042 (RN-11, RN-41, docs/05 §9.38) · Toda empresa nace en el plan
// Gratis, sin funciones de pago. Las pruebas que ejercen la IA, las
// sugerencias, las postulaciones o los consultores pasan sus empresas a un plan
// temporal: de empresa, INACTIVO (nunca aparece en el comparador ni en la
// portada), con 125 créditos —el cupo del antiguo Trial, del que dependen las
// cuentas de esas pruebas— y todas las funciones. Se borra al final.
//
//   import { prepararPlanes } from "./plan-prueba.mjs";
//   const planes = await prepararPlanes(svc, sufijo);
//   await planes.pasarA(usuarioId);   // tras crear la empresa
//   await planes.limpiar();           // al final, tras borrar las cuentas

const hoyColombia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
const masDias = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

export async function prepararPlanes(svc, sufijo, { creditos = 125 } = {}) {
  const { data: plan, error } = await svc
    .from("planes")
    .insert({
      nombre: `Prueba ${sufijo}`,
      rol: "empresa",
      precio_mensual: 1,
      precio_anual: 1,
      creditos_ia_mensuales: creditos,
      activo: false,
      incluye_proyecto_ia: true,
      incluye_sugerencias: true,
      incluye_documento_ia: true,
      incluye_postulaciones: true,
      incluye_consultores: true,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Plan de prueba: no se pudo crear (${error.message})`);

  return {
    id: plan.id,
    /** La empresa pasa al plan de prueba, vigente 30 días. */
    async pasarA(usuarioId, { planId = plan.id } = {}) {
      const { error: e } = await svc
        .from("suscripciones")
        .update({ plan_id: planId, modalidad: "mensual", estado: "activa", fecha_vencimiento: masDias(hoyColombia(), 30) })
        .eq("usuario_id", usuarioId);
      if (e) throw new Error(`Plan de prueba: no se pudo asignar (${e.message})`);
    },
    /** Borra el plan; las suscripciones que lo citaban se fueron con sus cuentas. */
    async limpiar() {
      await svc.from("suscripciones").delete().eq("plan_id", plan.id);
      const { error: e } = await svc.from("planes").delete().eq("id", plan.id);
      if (e) console.error("Plan de prueba: no se pudo borrar", plan.id, e.message);
    },
  };
}
