import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { sugerenciasDeProyecto } from "@/lib/sugerencias";

type Params = { params: Promise<{ id: string }> };

// CU-10, RF-15, RF-16 · Convocatorias vigentes que coinciden con el proyecto, con
// porcentaje y desglose; sin coincidencias, el criterio que más restringe (2a).
// Proyecto ajeno: 404 (RN-30). Sin suscripción vigente: 402 (CU-10 2b, RNF-20).
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await sugerenciasDeProyecto(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
