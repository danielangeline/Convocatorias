import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, UUID } from "@/lib/api-empresa";
import { obtenerFicha } from "@/lib/catalogo";

type Params = { params: Promise<{ id: string }> };

// RF-13, CU-08 · Ficha de la convocatoria. Si la RLS no deja verla, no existe.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const ficha = UUID.test(id) ? await obtenerFicha(id) : null;
    if (!ficha) return NextResponse.json({ error: "La convocatoria no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: ficha });
  });
}
