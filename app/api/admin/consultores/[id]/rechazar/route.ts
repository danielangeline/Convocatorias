import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { rechazarPerfil } from "@/lib/admin/consultores";

// CU-25 · RF-34 · RN-13: { motivo } obligatorio.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => rechazarPerfil(id, cuerpo), { id });
}
