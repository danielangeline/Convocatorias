import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { UUID } from "@/lib/api-empresa";
import { obtenerFicha } from "@/lib/catalogo";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string; convocatoriaId: string }> };

// RF-91, CU-08 · La ficha, desde el encargo. Solo vigentes: una que cerró o se
// despublicó deja de existir aquí, aunque la RLS se la deje ver al consultor
// por otro encargo.
export async function GET(request: NextRequest, { params }: Params) {
  const { id, convocatoriaId } = await params;
  return conConsultor(request, async () => {
    const encargo = await encargoDeBusqueda(id);
    const ficha = encargo && UUID.test(convocatoriaId) ? await obtenerFicha(convocatoriaId) : null;
    if (!ficha || ficha.estado !== "publicada") return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: ficha });
  });
}
