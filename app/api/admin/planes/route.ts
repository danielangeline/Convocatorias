import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { guardarPlan, listarPlanesAdmin } from "@/lib/admin/suscripciones";

// CU-31 paso 1 · RF-36 · Planes, también los inactivos. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarPlanesAdmin() }));
}

// Cuerpo: { nombre, rol, precioMensual, precioAnual, creditosIaMensuales, activo }. Crea un plan.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => guardarPlan(null, cuerpo));
}
