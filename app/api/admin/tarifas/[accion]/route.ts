import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { guardarTarifa } from "@/lib/admin/suscripciones";

// RF-100 · Cuántos créditos cuesta una acción de la IA. Solo administrador con MFA; al resto, 404 (RF-85).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;
  return conAdministrador(request, (cuerpo) => guardarTarifa(accion, cuerpo));
}
