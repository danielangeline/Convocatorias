import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { listarCatalogo } from "@/lib/catalogo";
import { filtrarCatalogo } from "@/lib/catalogo-filtros";
import { leerMontoCOP } from "@/lib/montos";
import { esCodigoDepartamento } from "@/lib/departamentos";

// RF-11, RF-12, CU-07 · Catálogo de la empresa: publicadas y vigentes (RN-33),
// con texto libre y filtros combinables. Las cerradas solo con
// incluirCerradas=true, detrás de las vigentes (RN-02). Las categorías van como ids separados
// por comas; montoHasta en pesos, en formato colombiano (CU-02 2b); departamento
// como código DANE, y trae también las de cobertura nacional (RN-34).
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => {
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

    const datos = filtrarCatalogo(await listarCatalogo(p.get("incluirCerradas") === "true"), {
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
