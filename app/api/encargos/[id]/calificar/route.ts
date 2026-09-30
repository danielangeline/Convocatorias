import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { calificarEncargo } from "@/lib/encargos-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-33, RN-09, CU-24 · { estrellas, comentario? }, una sola vez.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await calificarEncargo(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
