import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { activarPlantilla } from "@/lib/admin/plantillas";

// CU-37 paso 3 · Deja esta versión como la única activa.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => activarPlantilla(id), { id });
}
