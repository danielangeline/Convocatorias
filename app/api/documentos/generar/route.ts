import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { generarDocumento } from "@/lib/documentos-servidor";

// RNF-21: la IA tiene hasta 110 s; el resto es margen para leer adjuntos y guardar.
export const maxDuration = 150;

// CU-33, RF-48, RF-78 · Generar o regenerar el documento de un par
// proyecto-convocatoria. Un crédito solo si sale bien (RN-17).
export async function POST(request: NextRequest) {
  return conEmpresa(request, async (usuarioId) => {
    const r = await generarDocumento(usuarioId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos }, { status: 201 });
  });
}
