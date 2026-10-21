import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { listarCatalogo } from "@/lib/catalogo";
import { DIAS_CIERRE, TIPOS_DOCUMENTO, esClaveOrden, filtrarCatalogo, ordenarCatalogo, type Alcance, type ClaveOrden, type FiltroMonto } from "@/lib/catalogo-filtros";
import { leerMontoCOP } from "@/lib/montos";
import { esClaveRegion, esCodigoDepartamento } from "@/lib/departamentos";
import type { TipoDocumento } from "@/lib/types";

// RF-11, RF-12, RF-94, CU-07 · Catálogo de la empresa: publicadas y vigentes (RN-33),
// con texto libre, 20 filtros combinables y orden. Las cerradas solo con
// incluirCerradas=true, detrás de las vigentes (RN-02). Las categorías van como ids
// separados por comas; los montos en pesos, en formato colombiano (CU-02 2b);
// departamento como código DANE, y trae también las de cobertura nacional (RN-34).
// Un valor fuera de lo permitido responde 400: nunca se ignora en silencio.
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const fechaValida = (v: string) => FECHA.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => {
    const p = request.nextUrl.searchParams;
    const lista = (clave: string) => (p.get(clave) ?? "").split(",").map((v) => v.trim()).filter(Boolean);

    const montoHasta = leerMontoCOP(p.get("montoHasta") ?? "");
    if (!montoHasta.ok) return bad(`El monto máximo exigido ${montoHasta.error}`);
    const montoDesde = leerMontoCOP(p.get("montoDesde") ?? "");
    if (!montoDesde.ok) return bad(`El monto de apoyo ${montoDesde.error}`);

    const departamento = p.get("departamento") ?? "";
    if (departamento && !esCodigoDepartamento(departamento)) return bad("El departamento debe ir con su código DANE de dos cifras (p. ej. 05).");
    const region = p.get("region") ?? "";
    if (region && !esClaveRegion(region)) return bad("La región debe ser andina, caribe, pacifica, orinoquia, amazonia o insular.");
    const alcance = p.get("alcance") ?? "";
    if (alcance && alcance !== "nacional" && alcance !== "territorial") return bad("El alcance debe ser nacional o territorial.");
    const monto = p.get("monto") ?? "";
    if (monto && monto !== "con" && monto !== "sin") return bad("El filtro de monto debe ser con o sin.");

    for (const clave of ["cierraAntesDe", "cierraDesde", "abreDesde"]) {
      const v = p.get(clave) ?? "";
      if (v && !fechaValida(v)) return bad(`La fecha ${clave} debe ir como AAAA-MM-DD.`);
    }
    const dias = p.get("cierraEnDias");
    if (dias != null && dias !== "" && !(DIAS_CIERRE as readonly number[]).includes(Number(dias))) return bad(`cierraEnDias debe ser ${DIAS_CIERRE.join(", ")}.`);
    const anio = p.get("anioCierre");
    if (anio != null && anio !== "" && !/^\d{4}$/.test(anio)) return bad("El año de cierre debe tener cuatro cifras.");
    const maxReq = p.get("maxRequisitos");
    if (maxReq != null && maxReq !== "" && !/^\d{1,3}$/.test(maxReq)) return bad("maxRequisitos debe ser un entero.");

    const tipoDoc = lista("tipoDoc");
    const validos = TIPOS_DOCUMENTO.map((t) => t.clave as string);
    if (tipoDoc.some((t) => !validos.includes(t))) return bad(`tipoDoc debe ser ${validos.join(", ")}.`);
    const exige = p.get("exigeDocumentos") ?? "";
    if (exige && exige !== "true" && exige !== "false") return bad("exigeDocumentos debe ser true o false.");
    // Sin `orden` se conserva el del catálogo: vigentes por cierre próximo y, detrás, las cerradas de la más reciente a la más antigua (RF-11).
    const orden = p.get("orden") ?? "";
    if (orden && !esClaveOrden(orden)) return bad("El orden pedido no existe.");

    const filtradas = filtrarCatalogo(await listarCatalogo(p.get("incluirCerradas") === "true"), {
      q: p.get("q") ?? "",
      tipoProyecto: lista("tipoProyecto"),
      sector: lista("sector"),
      tipoEntidad: lista("tipoEntidad"),
      entidad: p.get("entidad") ?? "",
      departamento,
      region: region as never,
      alcance: alcance as Alcance | "",
      montoHasta: montoHasta.valor,
      montoDesde: montoDesde.valor,
      monto: monto as FiltroMonto | "",
      cierraAntesDe: p.get("cierraAntesDe") ?? "",
      cierraDesde: p.get("cierraDesde") ?? "",
      cierraEnDias: dias ? Number(dias) : null,
      anioCierre: anio ? Number(anio) : null,
      abreDesde: p.get("abreDesde") ?? "",
      tipoDoc: tipoDoc as TipoDocumento[],
      exigeDocumentos: exige === "true",
      maxRequisitos: maxReq ? Number(maxReq) : null,
    });
    return NextResponse.json({ ok: true, datos: orden ? ordenarCatalogo(filtradas, orden as ClaveOrden) : filtradas });
  });
}
