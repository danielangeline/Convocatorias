import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { guardarTasa, listarTasasAdmin } from "@/lib/admin/tasas";

// RF-117, RN-40 · Tasas de referencia por moneda. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarTasasAdmin() }));
}

// Cuerpo: { moneda: "USD", copPorUnidad: "4.150,25", vigenteDesde: "AAAA-MM-DD" }. Crea o reemplaza la de esa moneda.
export async function PUT(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => guardarTasa(cuerpo));
}
