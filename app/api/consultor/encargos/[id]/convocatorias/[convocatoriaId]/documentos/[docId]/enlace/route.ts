import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { UUID } from "@/lib/api-empresa";
import { enlaceDeDescarga, obtenerFicha } from "@/lib/catalogo";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string; convocatoriaId: string; docId: string }> };

// RF-91, RNF-16 · URL firmada de 15 minutos para un adjunto de una vigente,
// desde el encargo. Storage la firma solo si la fila es visible (docs/05 §9.14).
export async function GET(request: NextRequest, { params }: Params) {
  const { id, convocatoriaId, docId } = await params;
  return conConsultor(request, async () => {
    const noExiste = NextResponse.json({ error: "El documento no existe." }, { status: 404 });
    if (!UUID.test(convocatoriaId) || !UUID.test(docId) || !(await encargoDeBusqueda(id))) return noExiste;
    const ficha = await obtenerFicha(convocatoriaId);
    if (!ficha || ficha.estado !== "publicada") return noExiste;
    const r = await enlaceDeDescarga(convocatoriaId, docId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: { url: r.url } });
  });
}
