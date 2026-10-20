import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { otorgarCreditos } from "@/lib/admin/suscripciones";

// CU-31 paso 3 · RF-51 · Cuerpo: { cantidad, monto }. Paquete de créditos adicionales (monto 0: cortesía).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => otorgarCreditos(id, cuerpo), { id });
}
