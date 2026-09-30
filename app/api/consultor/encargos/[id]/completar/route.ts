import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { completarEncargo } from "@/lib/encargos-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-32, RF-33 · Marca la finalización; el contador del consultor avanza.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const r = await completarEncargo(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
