import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { retirarPropuesta } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-92 · El consultor retira una propuesta que la empresa no ha elegido.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const r = await retirarPropuesta(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
