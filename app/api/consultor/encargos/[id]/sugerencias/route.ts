import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";
import { sugerenciasDeEncargo } from "@/lib/sugerencias";

type Params = { params: Promise<{ id: string }> };

// RF-91, RN-25 · Las sugerencias del proyecto del encargo, sin exigir la
// suscripción de la empresa.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const encargo = await encargoDeBusqueda(id);
    if (!encargo) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    const r = await sugerenciasDeEncargo(encargo.id, encargo.proyectoId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
