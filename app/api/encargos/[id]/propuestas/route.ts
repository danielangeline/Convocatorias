import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { propuestasDeEncargo } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-92 · Las propuestas del consultor en un encargo propio, con la
// compatibilidad con el proyecto calculada ahora.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await propuestasDeEncargo(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
