import { SIN_FUNCIONES, type FuncionPlan, type FuncionesPlan, type Plan, type RolPlan } from "./types";

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

/** Columnas de `planes` que se leen en todas partes (docs/05 §9.38). */
export const COLUMNAS_PLAN =
  "id, nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, es_gratuito, activo, incluye_proyecto_ia, incluye_sugerencias, incluye_documento_ia, incluye_postulaciones, incluye_consultores";

export interface FilaPlan {
  id: string;
  nombre: string;
  rol: string;
  precio_mensual: number | string;
  precio_anual: number | string;
  creditos_ia_mensuales: number;
  es_gratuito: boolean;
  activo?: boolean;
  incluye_proyecto_ia: boolean;
  incluye_sugerencias: boolean;
  incluye_documento_ia: boolean;
  incluye_postulaciones: boolean;
  incluye_consultores: boolean;
}

export function funcionesDeFila(f: Partial<FilaPlan> | null | undefined): FuncionesPlan {
  if (!f) return { ...SIN_FUNCIONES };
  return {
    proyecto_ia: f.incluye_proyecto_ia === true,
    sugerencias: f.incluye_sugerencias === true,
    documento_ia: f.incluye_documento_ia === true,
    postulaciones: f.incluye_postulaciones === true,
    consultores: f.incluye_consultores === true,
  };
}

export function aPlan(f: FilaPlan): Plan {
  return {
    id: f.id,
    nombre: f.nombre,
    rol: f.rol as RolPlan,
    precioMensual: Number(f.precio_mensual),
    precioAnual: Number(f.precio_anual),
    creditosIaMensuales: f.creditos_ia_mensuales,
    esGratuito: f.es_gratuito === true,
    funciones: funcionesDeFila(f),
    activo: f.activo,
  };
}

/**
 * RN-41, RF-120 · Qué es cada función, para el comparador, la portada y la
 * pantalla bloqueada. El texto es de la interfaz; si un plan la incluye o no
 * es dato del plan.
 */
export const FUNCIONES: Record<FuncionPlan, { titulo: string; beneficio: string; explicacion: string }> = {
  proyecto_ia: {
    titulo: "Proyecto con IA",
    beneficio: "Crear el proyecto con IA (texto o audio) y editar sus apartados con IA",
    explicacion:
      "Cuente su proyecto por escrito o en voz alta y la IA arma la ficha completa, con sus filtros; después puede pedirle que reescriba cualquier apartado. Lo que usted no dijo queda marcado para completar: la IA no inventa datos.",
  },
  sugerencias: {
    titulo: "Sugerencias por compatibilidad",
    beneficio: "Sugerencias de convocatorias por compatibilidad con sus proyectos",
    explicacion:
      "Cruzamos los datos de cada proyecto con los requisitos de las convocatorias vigentes y le mostramos un porcentaje de compatibilidad con su desglose, para que sepa cuáles le aplican sin leer cada TDR.",
  },
  documento_ia: {
    titulo: "Documento base con IA",
    beneficio: "Documento base de postulación con IA, con ajustes",
    explicacion:
      "Genere el documento base de la postulación a partir de su proyecto y del TDR oficial, ajústelo con IA y expórtelo en Word. Lo que falte queda marcado como [COMPLETAR] y se lo listamos.",
  },
  postulaciones: {
    titulo: "Postulaciones",
    beneficio: "Postulaciones con checklist de requisitos, avance y seguimiento",
    explicacion:
      "Al postular, copiamos los requisitos de la convocatoria a un checklist para que marque su avance y lleve el seguimiento por estados. La radicación se hace en el portal oficial de la entidad.",
  },
  consultores: {
    titulo: "Consultores",
    beneficio: "Directorio de consultores, encargos, calificaciones y documentos compartidos",
    explicacion:
      "Busque consultores aprobados por nuestro equipo, encárgueles una tarea sobre su proyecto, compártales sus documentos y califique su trabajo al terminar. El pago del servicio se acuerda directamente con el consultor.",
  },
};

export const ORDEN_FUNCIONES: FuncionPlan[] = ["proyecto_ia", "sugerencias", "documento_ia", "postulaciones", "consultores"];

/**
 * RF-120 · El plan de pago más barato del rol que incluye la función: «Disponible
 * en el plan Esencial». Sale de los datos de los planes, no de un nombre fijo.
 */
export function planQueIncluye(funcion: FuncionPlan, planes: Plan[]): Plan | null {
  const candidatos = planes
    .filter((p) => p.rol === "empresa" && p.activo !== false && !p.esGratuito && p.funciones?.[funcion])
    .sort((a, b) => a.precioMensual - b.precioMensual);
  return candidatos[0] ?? null;
}

/** Nombre corto para la interfaz: «Empresa Esencial» → «Esencial». */
export function nombreCortoPlan(nombre: string): string {
  return nombre.replace(/^Empresa\s+/i, "").trim() || nombre;
}

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
  if (plan.rol === "consultor") {
    return [
      { texto: "Visibilidad en el directorio" },
      { texto: "Recepción de encargos ilimitados" },
      { texto: "Acceso a los documentos que la empresa te autorice" },
    ];
  }
  // RN-41: lo que abre cada plan de empresa sale de sus banderas.
  const comunes: BeneficioPlan[] = [
    { texto: "Catálogo de convocatorias verificadas, filtros y guardadas" },
    { texto: "Proyectos con el formulario, sin límite" },
  ];
  const funciones: Partial<FuncionesPlan> = plan.funciones ?? {};
  const incluidas: BeneficioPlan[] = ORDEN_FUNCIONES.filter((f) => funciones[f]).map((f) => ({
    texto: FUNCIONES[f].beneficio,
    destacado: f === "consultores",
  }));
  // El cupo solo se enuncia cuando el plan lo incluye (RF-41).
  const cupo: BeneficioPlan[] =
    plan.creditosIaMensuales > 0 ? [{ texto: textoCreditosPlan(plan, tarifaDocumento), destacado: true }] : [];
  return [...cupo, ...comunes, ...incluidas];
}

/** RN-41 · Las funciones que el plan no incluye, para mostrarlas tachadas en el comparador. */
export function funcionesNoIncluidas(plan: Plan): FuncionPlan[] {
  if (plan.rol !== "empresa") return [];
  return ORDEN_FUNCIONES.filter((f) => !plan.funciones?.[f]);
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
