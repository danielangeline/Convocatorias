import { NextResponse, type NextRequest } from "next/server";
import { UUID, conEmpresa } from "@/lib/api-empresa";
import { urlHojaDeVidaParaEmpresa } from "@/lib/consultores-directorio";

type Params = { params: Promise<{ id: string }> };

// CU-21 · RF-80 · RNF-16. URL firmada de 15 minutos, solo con encargo en curso.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    if (!UUID.test(id)) return NextResponse.json({ error: "No encontramos este consultor." }, { status: 404 });
    const r = await urlHojaDeVidaParaEmpresa(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
