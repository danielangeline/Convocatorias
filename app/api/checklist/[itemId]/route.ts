import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { marcarItem } from "@/lib/postulaciones-servidor";

type Params = { params: Promise<{ itemId: string }> };

// RF-18, RN-35, CU-12 · Marcar o desmarcar un ítem; en una postulación cerrada, 409.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { itemId } = await params;
  return conEmpresa(request, async () => {
    const r = await marcarItem(itemId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
