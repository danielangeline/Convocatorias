import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { listarCatalogo } from "@/lib/catalogo";
import { filtrarCatalogo } from "@/lib/catalogo-filtros";
import { leerMontoCOP } from "@/lib/montos";
import { esCodigoDepartamento } from "@/lib/departamentos";
import { encargoDeBusqueda } from "@/lib/propuestas-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-91, RN-33 (excepción) · El catálogo vigente, solo desde un encargo
// "buscar convocatoria" en curso del consultor; si no, 404. Mismos filtros que
// GET /api/convocatorias, sin cerradas: el consultor solo ve las vigentes.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    if (!(await encargoDeBusqueda(id))) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    const p = request.nextUrl.searchParams;
    const lista = (clave: string) => (p.get(clave) ?? "").split(",").map((v) => v.trim()).filter(Boolean);
    const monto = leerMontoCOP(p.get("montoHasta") ?? "");
    if (!monto.ok) return NextResponse.json({ error: `El monto ${monto.error}` }, { status: 400 });
    const departamento = p.get("departamento") ?? "";
    if (departamento && !esCodigoDepartamento(departamento)) {
      return NextResponse.json({ error: "El departamento debe ir con su código DANE de dos cifras (p. ej. 05)." }, { status: 400 });
    }
    const cierre = p.get("cierraAntesDe") ?? "";
    if (cierre && !/^\d{4}-\d{2}-\d{2}$/.test(cierre)) {
      return NextResponse.json({ error: "La fecha de cierre debe ir como AAAA-MM-DD." }, { status: 400 });
    }
    const datos = filtrarCatalogo(await listarCatalogo(false), {
      q: p.get("q") ?? "",
      tipoProyecto: lista("tipoProyecto"),
      sector: lista("sector"),
      entidad: p.get("entidad") ?? "",
      departamento,
      montoHasta: monto.valor,
      cierraAntesDe: cierre,
    });
    return NextResponse.json({ ok: true, datos });
  });
}
