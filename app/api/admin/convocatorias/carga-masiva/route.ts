import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { cargaMasiva } from "@/lib/admin/carga-masiva-servidor";

// CU-50, RF-118 · Carga masiva desde un CSV. Cuerpo: { csv, confirmar }. Sin confirmar
// solo valida; confirmando, crea en borrador las filas válidas. Nunca publica.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo, usuarioId) => cargaMasiva(cuerpo, usuarioId));
}
