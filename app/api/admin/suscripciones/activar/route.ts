import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { activarSuscripcion } from "@/lib/admin/suscripciones";

// CU-31 paso 2 · RF-38 · Cuerpo: { usuarioId, planId, modalidad, monto, fechaPago }. Activa o renueva y registra el pago.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => activarSuscripcion(cuerpo));
}
