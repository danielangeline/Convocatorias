import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { activarPlantillaProyecto } from "@/lib/admin/plantillas";

// CU-37 paso 3 · RF-99 · Deja esta versión de la plantilla de proyectos como la única activa.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => activarPlantillaProyecto(id), { id });
}
