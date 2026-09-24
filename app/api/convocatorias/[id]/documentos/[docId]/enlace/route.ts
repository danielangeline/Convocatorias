import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, UUID } from "@/lib/api-empresa";
import { enlaceDeDescarga } from "@/lib/catalogo";

type Params = { params: Promise<{ id: string; docId: string }> };

// CU-08 paso 3, RNF-16 · URL firmada de 15 minutos para un adjunto que la
// empresa puede ver (docs/05 §9.14).
export async function GET(request: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  return conEmpresa(request, async () => {
    if (!UUID.test(id) || !UUID.test(docId)) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
    const r = await enlaceDeDescarga(id, docId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: { url: r.url } });
  });
}
