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
 * (`tiene_suscripcion_vigente`), así que no depende de que el job haya corrido.
 * Solo informa: lo que se restringe lo decide el servidor (RF-40).
 */
export function AvisoSuscripcion({ suscripcion }: { suscripcion: Suscripcion | null }) {
  if (!suscripcion || suscripcion.estado === "suspendida") return null;
  const dias = diasEntre(hoyColombia(), suscripcion.fechaVencimiento);
  const trial = suscripcion.modalidad === "trial";
  const que = trial ? "Tu prueba gratuita" : "Tu suscripción";
  const vence = formatFecha(suscripcion.fechaVencimiento);

  let mensaje: string;
  let urgente = false;
  if (suscripcion.estado === "vencida" || dias + DIAS_GRACIA < 0) {
    urgente = true;
    mensaje = `${que} venció el ${vence} y terminó el periodo de gracia. No puedes postular, ver sugerencias ni solicitar consultores; el catálogo sigue disponible.`;
  } else if (dias < 0) {
    urgente = true;
    const quedan = DIAS_GRACIA + dias;
    mensaje = `${que} venció el ${vence}. Estás en periodo de gracia: ${
      quedan === 0 ? "hoy es el último día" : `te quedan ${plural(quedan, "día", "días")}`
    } antes de que se restrinja el acceso.`;
  } else if (dias <= AVISAR_DESDE) {
    mensaje = `${que} vence ${dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`} (${vence}). Después tendrás ${DIAS_GRACIA} días de gracia.`;
  } else {
    return null;
  }

  const Icono = urgente ? AlertTriangle : Clock;
  return (
    <div
      role="status"
      className={
        urgente
          ? "mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-red-200 bg-danger-bg px-4 py-3 text-sm text-danger"
          : "mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      }
    >
      <Icono className="h-4 w-4 shrink-0" aria-hidden />
      <p className="flex-1">{mensaje}</p>
      <Link href="/suscripcion" className="font-semibold underline underline-offset-2">
        Ver mi suscripción
      </Link>
    </div>
  );
}
