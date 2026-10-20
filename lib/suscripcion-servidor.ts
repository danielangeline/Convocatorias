import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Pago, Plan, RolPlan } from "@/lib/types";

/**
 * CU-28, CU-30 · RF-41, RF-82 · Lo que el suscriptor lee de su plan (docs/05
 * §9.28). Todo con su sesión: la RLS solo deja ver los planes activos y los
 * pagos de su propia suscripción.
 */

/** Planes activos del rol, sin el trial (no se compra): el comparador (RF-82). */
export async function listarPlanesDelRol(rol: RolPlan): Promise<Plan[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("planes")
    .select("id, nombre, rol, precio_mensual, precio_anual, creditos_ia_mensuales, es_trial, activo")
    .eq("rol", rol)
    .eq("es_trial", false)
    .order("precio_mensual");
  if (error) throw new Error(`Planes: listar del rol falló (${error.code})`);
  return (data ?? []).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    rol: f.rol as RolPlan,
    precioMensual: Number(f.precio_mensual),
    precioAnual: Number(f.precio_anual),
    creditosIaMensuales: f.creditos_ia_mensuales,
    esTrial: false,
    activo: f.activo,
  }));
}

/** CU-30 paso 3 · Historial de pagos de la propia suscripción, el más reciente primero. */
export async function listarPagosPropios(): Promise<Pago[]> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("pagos_suscripcion")
    .select("id, suscripcion_id, monto, fecha_pago, concepto, modalidad, creditos, creado_at, planes (nombre)")
    .order("fecha_pago", { ascending: false })
    .order("creado_at", { ascending: false });
  if (error) throw new Error(`Pagos: listar falló (${error.code})`);
  return (data ?? []).map((f) => ({
    id: f.id,
    suscripcionId: f.suscripcion_id,
    monto: Number(f.monto),
    fecha: f.fecha_pago,
    concepto: f.concepto as "suscripcion" | "paquete",
    planNombre: (f.planes as unknown as { nombre: string } | null)?.nombre ?? null,
    modalidad: f.modalidad as "mensual" | "anual" | null,
    creditos: f.creditos,
  }));
}
