import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { suspenderConsultor } from "@/lib/admin/consultores";

// CU-27 · RF-35 · RN-29: { motivo } obligatorio; cancela los encargos en curso y pendientes.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => suspenderConsultor(id, cuerpo), { id });
}
