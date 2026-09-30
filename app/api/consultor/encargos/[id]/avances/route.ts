import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { cuerpoDe } from "@/lib/api-empresa";
import { registrarAvance } from "@/lib/encargos-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-32 · { nota }: solo en un encargo en curso.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const r = await registrarAvance(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
