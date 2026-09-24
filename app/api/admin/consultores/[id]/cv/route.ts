import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { urlHojaDeVida } from "@/lib/admin/consultores";

// CU-25 paso 2 · RNF-16. URL firmada de 15 minutos.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => urlHojaDeVida(id), { id });
}
