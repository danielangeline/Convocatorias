import type { Plan } from "./types";

/**
 * RF-82: los beneficios de un plan se derivan del propio dato del plan, no de
 * una lista fija en la interfaz. Así dos planes de distinto precio nunca
 * muestran lo mismo, y cambiar un cupo desde el panel admin se refleja en el
 * comparador sin desplegar (RNF-14).
 */

/**
 * CU-28 paso 3 · Durante el piloto no hay pasarela: el pago se acuerda por
 * fuera y el administrador activa el plan (RF-38). La pantalla no simula el
 * pago: dice cómo se contrata.
 */
export const CONTRATAR_EN_PILOTO =
  "Durante el piloto, los planes y los paquetes de créditos se contratan con nuestro equipo: acuerdas el pago por fuera de la plataforma y nosotros activamos tu plan. Aquí no se hace ningún cobro.";

export interface BeneficioPlan {
  texto: string;
  /** El atributo que diferencia este plan de los demás de su rol. */
  destacado?: boolean;
}

/**
 * Cupo de IA en créditos y en lo que alcanza (RN-17: cada documento cuesta la
 * tarifa de generación, 100 al iniciar la sesión 030).
 */
export function textoCreditosPlan(plan: Plan, tarifaDocumento: number): string {
  const n = plan.creditosIaMensuales;
  if (n <= 0) return "Sin créditos de IA incluidos";
  const documentos = tarifaDocumento > 0 ? Math.floor(n / tarifaDocumento) : 0;
  const alcance = documentos === 1 ? "1 documento" : `${documentos} documentos`;
  return `${n.toLocaleString("es-CO")} créditos de IA al mes (hasta ${alcance})`;
}

export function beneficiosDePlan(plan: Plan, tarifaDocumento: number): BeneficioPlan[] {
  const comunes: BeneficioPlan[] =
    plan.rol === "consultor"
      ? [
          { texto: "Visibilidad en el directorio" },
          { texto: "Recepción de encargos ilimitados" },
          { texto: "Acceso a los documentos que la empresa te autorice" },
        ]
      : [
          { texto: "Postulaciones y sugerencias ilimitadas" },
          { texto: "Solicitud de consultores" },
        ];

  // El cupo solo se enuncia cuando el plan lo incluye (RF-41): el plan de
  // consultor no tiene cupo propio, y anunciarlo como "0" sería ruido.
  if (plan.creditosIaMensuales > 0) {
    return [{ texto: textoCreditosPlan(plan, tarifaDocumento), destacado: true }, ...comunes];
  }
  return comunes;
}

/**
 * Comprueba que ningún par de planes del mismo rol presente exactamente los
 * mismos beneficios — la condición que RF-82 exige y que el comparador
 * incumplía al pintar una lista fija. Se usa en desarrollo.
 */
export function planesIndistinguibles(planes: Plan[]): Array<[string, string]> {
  const choques: Array<[string, string]> = [];
  const firma = (p: Plan) => beneficiosDePlan(p, 1).map((b) => b.texto).join("|");
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      if (planes[i].rol !== planes[j].rol) continue;
      if (firma(planes[i]) === firma(planes[j])) {
        choques.push([planes[i].nombre, planes[j].nombre]);
      }
    }
  }
  return choques;
}
