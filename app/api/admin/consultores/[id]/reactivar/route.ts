import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { reactivarConsultor } from "@/lib/admin/consultores";

// CU-27 3a · RF-35. Vuelve a aprobado; los encargos cancelados no se reabren.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => reactivarConsultor(id), { id });
}
