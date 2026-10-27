import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { leerMontoCOP } from "@/lib/montos";
import { hoyColombia } from "@/lib/fechas";
import type { CuentaSuscripcion, EstadoSuscripcion, ModalidadSuscripcion, Plan, RolPlan, TableroSuscripciones } from "@/lib/types";
import type { Resultado } from "./administradores";

// CU-28..31 · RF-36, RF-38, RF-42, RF-51 · Planes y suscripciones en el panel
// (docs/05 §9.28). Todo va con la sesión del administrador: la RLS deja leer y
// las funciones de la base exigen aal2 (RNF-28) y deciden las reglas.

type Cuerpo = Record<string, unknown> | null;
const invalido = (error: string) => ({ ok: false as const, status: 400, error });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Sesión 030: los créditos se cuentan por tarifa (RN-17), así que los topes suben.
export const LIMITES_PLAN = { nombreMax: 80, precioMax: 100_000_000, creditosMax: 1_000_000, diasTrialMax: 60, paqueteMax: 100_000 } as const;

const MENSAJES: Record<string, { status: number; error: string }> = {
  no_es_admin: { status: 404, error: "No encontrado." },
  plan_no_existe: { status: 404, error: "El plan no existe." },
  suscripcion_no_existe: { status: 404, error: "La suscripción no existe." },
  nombre_repetido: { status: 409, error: "Ya hay un plan con ese nombre para ese rol." },
  plan_en_uso: { status: 409, error: "El plan tiene suscripciones: no puede cambiar de rol." },
  trial_fijo: { status: 409, error: "El plan de prueba sigue siendo de empresa, gratis y activo: solo cambian su nombre, créditos y días." },
  cuenta_invalida: { status: 404, error: "La cuenta no existe o no es de empresa ni de consultor." },
  plan_invalido: { status: 409, error: "Ese plan no está activo o no es del rol de la cuenta." },
  consultor_no_aprobado: { status: 409, error: "El perfil del consultor aún no está aprobado: no puede suscribirse (CU-28)." },
  consultor_sin_creditos: { status: 409, error: "El consultor no tiene cupo de IA: los créditos solo se otorgan a empresas (RN-28)." },
  estado_invalido: { status: 409, error: "Solo se suspende una suscripción que hoy da acceso." },
  dato_invalido: { status: 400, error: "Algún dato no cumple las reglas: revisa la modalidad, el monto, la cantidad y la fecha." },
};

function rechazo(error: PostgrestError, accion: string) {
  const conocido = error.hint ? MENSAJES[error.hint] : undefined;
  if (conocido) return { ok: false as const, ...conocido };
  if (error.code === "23514") return invalido("Algún dato no cumple las reglas: revisa el nombre, los precios y los créditos.");
  console.error(`Suscripciones: ${accion} falló`, error.code, error.message);
  return { ok: false as const, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
}

const enteroEn = (v: unknown, min: number, max: number) => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};

/** Precio o monto en pesos: acepta 89.000 o 89000 (lib/montos.ts); null si no vale. */
function pesos(v: unknown, max: number): number | null {
  const lectura = leerMontoCOP(v);
  if (!lectura.ok || lectura.valor === null || lectura.valor > max) return null;
  return lectura.valor;
}

function planDeFila(f: Record<string, unknown>): Plan {
  return {
    id: f.id as string,
    nombre: f.nombre as string,
    rol: f.rol as RolPlan,
    precioMensual: Number(f.precio_mensual),
    precioAnual: Number(f.precio_anual),
    creditosIaMensuales: Number(f.creditos_ia_mensuales),
    esTrial: f.es_trial === true,
    activo: f.activo === true,
    diasTrial: (f.dias_trial as number | null) ?? null,
  };
}

export async function listarPlanesAdmin(): Promise<Plan[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes")
    .select("id, nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, es_trial, activo, dias_trial")
    .order("rol")
    .order("precio_mensual");
  if (error) throw new Error(`Planes: listar falló (${error.code})`);
  return (data ?? []).map(planDeFila);
}

/** Cuerpo: { nombre, rol, precioMensual, precioAnual, creditosIaMensuales, activo, diasTrial? }. id nulo crea. */
export async function guardarPlan(id: string | null, cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const L = LIMITES_PLAN;
  const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre.trim() : "";
  const rol = cuerpo?.rol;
  if (!nombre || nombre.length > L.nombreMax) return invalido(`El nombre es obligatorio y tiene hasta ${L.nombreMax} caracteres.`);
  if (rol !== "empresa" && rol !== "consultor") return invalido("El rol es empresa o consultor.");
  const mensual = pesos(cuerpo?.precioMensual, L.precioMax);
  const anual = pesos(cuerpo?.precioAnual, L.precioMax);
  if (mensual === null || anual === null) {
    return invalido("Los precios van en pesos enteros, con puntos de miles o sin ellos (89.000), hasta 100.000.000.");
  }
  const creditos = enteroEn(cuerpo?.creditosIaMensuales, 0, L.creditosMax);
  if (creditos === null) return invalido(`Los créditos de IA son un entero de 0 a ${L.creditosMax}.`);
  if (rol === "consultor" && creditos > 0) return invalido("El plan de consultor no incluye créditos de IA (RN-28).");
  const activo = cuerpo?.activo !== false;
  let diasTrial: number | null = null;
  if (cuerpo?.diasTrial !== undefined && cuerpo?.diasTrial !== null) {
    diasTrial = enteroEn(cuerpo.diasTrial, 1, L.diasTrialMax);
    if (diasTrial === null) return invalido(`Los días de prueba son un entero de 1 a ${L.diasTrialMax}.`);
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("guardar_plan", {
    p_id: id,
    p_nombre: nombre,
    p_rol: rol,
    p_precio_mensual: mensual,
    p_precio_anual: anual,
    p_creditos: creditos,
    p_activo: activo,
    p_dias_trial: diasTrial,
  });
  if (error) return rechazo(error, "guardar plan");
  return {
    ok: true,
    datos: { id: data as string },
    aviso: id
      ? "Plan actualizado. Los cambios de créditos rigen desde ya para todos sus suscriptores."
      : "Plan creado.",
  };
}

const n = (v: unknown) => Number(v ?? 0);

export async function listarCuentasYTablero(): Promise<{ cuentas: CuentaSuscripcion[]; tablero: TableroSuscripciones }> {
  const supabase = await crearClienteServidor();
  const [{ data: cuentas, error }, { data: tablero, error: eT }] = await Promise.all([
    supabase.rpc("cuentas_suscripcion_admin"),
    supabase.rpc("tablero_suscripciones").single(),
  ]);
  if (error) throw new Error(`Suscripciones: cuentas fallaron (${error.code})`);
  if (eT) throw new Error(`Suscripciones: tablero falló (${eT.code})`);
  const t = (tablero ?? {}) as Record<string, unknown>;
  return {
    cuentas: ((cuentas ?? []) as Record<string, unknown>[]).map((c) => ({
      usuarioId: c.usuario_id as string,
      rol: c.rol as RolPlan,
      nombre: (c.nombre as string | null) ?? "(sin nombre)",
      correo: (c.correo as string | null) ?? "",
      suscripcionId: (c.suscripcion_id as string | null) ?? null,
      planId: (c.plan_id as string | null) ?? null,
      planNombre: (c.plan_nombre as string | null) ?? null,
      modalidad: (c.modalidad as ModalidadSuscripcion | null) ?? null,
      estado: (c.estado as EstadoSuscripcion | null) ?? null,
      fechaInicio: (c.fecha_inicio as string | null) ?? null,
      fechaVencimiento: (c.fecha_vencimiento as string | null) ?? null,
      creditosIncluidos: n(c.creditos_incluidos),
      creditosUsados: n(c.creditos_usados),
      creditosExtra: n(c.creditos_extra),
    })),
    tablero: {
      trial: n(t.trial),
      activas: n(t.activas),
      enGracia: n(t.en_gracia),
      vencidas: n(t.vencidas),
      suspendidas: n(t.suspendidas),
      generacionesExitosas: n(t.generaciones_exitosas),
      generacionesFallidas: n(t.generaciones_fallidas),
      ajustes: n(t.ajustes),
      creditosDescontados: n(t.creditos_descontados),
      costoUsd: n(t.costo_usd),
    },
  };
}

/** Cuerpo: { usuarioId, planId, modalidad, monto, fechaPago }. RF-38. */
export async function activarSuscripcion(cuerpo: Cuerpo): Promise<Resultado<{ id: string }>> {
  const usuarioId = typeof cuerpo?.usuarioId === "string" ? cuerpo.usuarioId : "";
  const planId = typeof cuerpo?.planId === "string" ? cuerpo.planId : "";
  if (!UUID.test(usuarioId) || !UUID.test(planId)) return invalido("Elige la cuenta y el plan.");
  const modalidad = cuerpo?.modalidad;
  if (modalidad !== "mensual" && modalidad !== "anual") return invalido("La modalidad es mensual o anual.");
  const monto = pesos(cuerpo?.monto, 1_000_000_000);
  if (!monto) return invalido("Escribe el monto pagado en pesos enteros, mayor que cero (p. ej. 89.000).");
  const fechaPago = typeof cuerpo?.fechaPago === "string" ? cuerpo.fechaPago : "";
  if (!FECHA.test(fechaPago) || fechaPago > hoyColombia()) return invalido("La fecha del pago es obligatoria y no puede ser futura.");

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("activar_suscripcion", {
    p_usuario: usuarioId,
    p_plan: planId,
    p_modalidad: modalidad,
    p_monto: monto,
    p_fecha_pago: fechaPago,
  });
  if (error) return rechazo(error, "activar");
  return { ok: true, datos: { id: data as string }, aviso: "Pago registrado y suscripción activa." };
}

/** Cuerpo: { cantidad, monto }. RF-51: monto 0 es cortesía. */
export async function otorgarCreditos(suscripcionId: string, cuerpo: Cuerpo): Promise<Resultado> {
  const cantidad = enteroEn(cuerpo?.cantidad, 1, LIMITES_PLAN.paqueteMax);
  if (cantidad === null) return invalido(`La cantidad es un entero de 1 a ${LIMITES_PLAN.paqueteMax}.`);
  const monto = cuerpo?.monto === undefined || cuerpo?.monto === "" ? 0 : pesos(cuerpo?.monto, 1_000_000_000);
  if (monto === null) return invalido("El monto va en pesos enteros (0 si es de cortesía).");
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("otorgar_creditos_extra", { p_suscripcion: suscripcionId, p_cantidad: cantidad, p_monto: monto });
  if (error) return rechazo(error, "otorgar créditos");
  return { ok: true, aviso: `${cantidad} ${cantidad === 1 ? "crédito otorgado" : "créditos otorgados"}. No expiran.` };
}

export async function suspenderSuscripcion(suscripcionId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.rpc("suspender_suscripcion", { p_suscripcion: suscripcionId });
  if (error) return rechazo(error, "suspender");
  const cancelados = Number(data ?? 0);
  return {
    ok: true,
    aviso:
      cancelados > 0
        ? `Suscripción suspendida. Se cancelaron ${cancelados} ${cancelados === 1 ? "encargo" : "encargos"} del consultor.`
        : "Suscripción suspendida.",
  };
}

// ---------------------------------------------------------------------------
// RF-100 · Tarifas de créditos de la IA (docs/05 §9.32)
// ---------------------------------------------------------------------------

const ACCIONES_TARIFA = ["generacion", "estructuracion", "ajuste", "edicion_apartado"] as const;

/** Cuerpo: { creditos }. Cambia cuántos créditos cuesta una acción; rige desde el siguiente uso. */
export async function guardarTarifa(accion: string, cuerpo: Record<string, unknown> | null): Promise<Resultado> {
  if (!(ACCIONES_TARIFA as readonly string[]).includes(accion)) return { ok: false, status: 404, error: "Esa acción no existe." };
  const creditos = Number(cuerpo?.creditos);
  if (!Number.isInteger(creditos) || creditos < 1 || creditos > 100_000) {
    return { ok: false, status: 400, error: "La tarifa debe ser un número entero de créditos, de 1 a 100.000." };
  }
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("guardar_tarifa", { p_accion: accion, p_creditos: creditos });
  if (error) {
    if (error.hint === "no_es_admin") return { ok: false, status: 404, error: "No encontrado." };
    if (error.hint === "dato_invalido") return { ok: false, status: 400, error: "La tarifa debe ser un número entero de créditos, de 1 a 100.000." };
    console.error("Tarifas: guardar falló", error.code, error.message);
    return { ok: false, status: 500, error: "No pudimos completar la acción. Intenta de nuevo." };
  }
  return { ok: true, aviso: "Tarifa guardada: rige desde el siguiente uso." };
}
