import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import type { Suscripcion } from "@/lib/types";
import { diasEntre, hoyColombia } from "@/lib/fechas";
import { formatFecha } from "@/lib/utils";

const DIAS_GRACIA = 5;
const AVISAR_DESDE = 3;

const plural = (n: number, uno: string, varios: string) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

/**
 * RN-16, CU-32 paso 6 · Franja de aviso de la suscripción en el portal: desde 3
 * días antes del vencimiento, durante los 5 días de gracia y ya vencida. Se
 * calcula en el servidor con la fecha de Colombia, igual que la base
 * (`plan_efectivo`), así que no depende de que el job haya corrido.
 * Solo informa: lo que se restringe lo decide el servidor (RF-40).
 *
 * Sesión 042: el plan Gratis no vence y no lleva franja. Al terminar la gracia
 * de un plan de pago, la empresa baja a Gratis sin perder nada (RN-16).
 */
export function AvisoSuscripcion({ suscripcion, rol = "empresa" }: { suscripcion: Suscripcion | null; rol?: "empresa" | "consultor" }) {
  if (!suscripcion || suscripcion.estado === "suspendida" || suscripcion.estado === "gratis" || !suscripcion.fechaVencimiento) return null;
  const dias = diasEntre(hoyColombia(), suscripcion.fechaVencimiento);
  const que = "Su plan";
  const vence = formatFecha(suscripcion.fechaVencimiento);
  const empresa = rol === "empresa";

  let mensaje: string;
  let urgente = false;
  if (suscripcion.estado === "vencida" || dias + DIAS_GRACIA < 0) {
    urgente = true;
    mensaje = empresa
      ? `${que} venció el ${vence} y terminó el periodo de gracia: su cuenta pasa al plan Gratis. Todo lo que creó sigue aquí; la IA, las sugerencias, las postulaciones y los consultores quedan bloqueados hasta que renueve.`
      : `${que} venció el ${vence} y terminó el periodo de gracia.`;
  } else if (dias < 0) {
    urgente = true;
    const quedan = DIAS_GRACIA + dias;
    mensaje = `${que} venció el ${vence}. Está en periodo de gracia: ${
      quedan === 0 ? "hoy es el último día" : `le quedan ${plural(quedan, "día", "días")}`
    }${empresa ? " antes de pasar al plan Gratis. No se borra nada, pero las funciones de pago quedarán bloqueadas." : " antes de que se restrinja el acceso."}`;
  } else if (dias <= AVISAR_DESDE) {
    mensaje = `${que} vence ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`} (${vence}). Después tendrá ${DIAS_GRACIA} días de gracia.`;
  } else {
    return null;
  }

  const Icono = urgente ? AlertTriangle : Clock;
  return (
    <div
      role="status"
      className={
        urgente
          ? "mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose"
          : "mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber/30 bg-amber/10 px-4 py-3 text-sm text-amber-ink"
      }
    >
      <Icono className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{mensaje}</p>
      <Link href="/suscripcion" className="font-semibold underline underline-offset-2">
        Ver mi plan
      </Link>
    </div>
  );
}
