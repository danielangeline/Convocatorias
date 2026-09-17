import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { cambiarPublicacion } from "@/lib/admin/catalogo";

// CU-05 3b · Despublicar. A partir de aquí no se puede postular ni generar
// sobre ella (RN-03); las postulaciones ya iniciadas conservan su checklist (RN-04).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => cambiarPublicacion(id, false), { id });
}
