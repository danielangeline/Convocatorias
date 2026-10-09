import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { elegirPropuesta } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string; propuestaId: string }> };

// RF-93 · La empresa elige una propuesta: queda como la convocatoria del
// encargo, que sigue en curso. 409 si ya eligió o si la convocatoria dejó de
// estar vigente (RF-78).
export async function POST(request: NextRequest, { params }: Params) {
  const { id, propuestaId } = await params;
  return conEmpresa(request, async () => {
    const r = await elegirPropuesta(id, propuestaId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
