import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { cambiarEstado } from "@/lib/postulaciones-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-19, RF-83, CU-13 · Cambio de estado según el grafo; cerrar exige `confirmado`.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await cambiarEstado(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
