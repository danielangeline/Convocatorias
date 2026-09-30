import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { retirarEncargo } from "@/lib/encargos-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-89 · Retira una solicitud pendiente o esperando al equipo.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await retirarEncargo(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
