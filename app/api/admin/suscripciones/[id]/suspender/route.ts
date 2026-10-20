import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { suspenderSuscripcion } from "@/lib/admin/suscripciones";

// CU-31 paso 4 · Suspende por falta de pago; al consultor se le cancelan los encargos abiertos (RN-29).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => suspenderSuscripcion(id), { id });
}
