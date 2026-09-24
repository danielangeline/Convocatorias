import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { obtenerPostulacion, vincularProyecto } from "@/lib/postulaciones-servidor";

type Params = { params: Promise<{ id: string }> };

// CU-12, CU-13 · Detalle con checklist e historial. Una ajena no existe (RN-30).
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const postulacion = await obtenerPostulacion(id);
    if (!postulacion) return NextResponse.json({ error: "La postulación no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: postulacion });
  });
}

// CU-13 3a/5a, RN-35 · Vincular un proyecto a la postulación que no tiene. Solo una vez.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await vincularProyecto(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
