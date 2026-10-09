import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { cuerpoDe } from "@/lib/api-empresa";
import { proponerConvocatoria } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-92 · { convocatoriaId, nota }. 409 si ya la propuso, si la empresa ya
// eligió o si la convocatoria no está vigente.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const r = await proponerConvocatoria(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos }, { status: 201 });
  });
}
