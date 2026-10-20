import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { listarCuentasYTablero } from "@/lib/admin/suscripciones";

// CU-31 paso 5 · RF-42 · Cuentas con su suscripción y el tablero del periodo.
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarCuentasYTablero() }));
}
