import { NextResponse, type NextRequest } from "next/server";
import { conEmpresaOConsultor, cuerpoDe } from "@/lib/api-empresa";
import { ajustarDocumento } from "@/lib/documentos-servidor";
import { limitarIA } from "@/lib/limite-tasa";

export const maxDuration = 150;

// CU-34 paso 3, RF-59, RF-77, RN-28 · Ajuste en lenguaje natural: 3 gratis; del
// cuarto en adelante, un crédito de la empresa dueña aunque lo pida el consultor.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conEmpresaOConsultor(request, async (usuarioId, rol) => {
    // RF-66, RNF-27: antes de reservar crédito o llamar a la IA.
    const limitado = await limitarIA(usuarioId, "/api/documentos/ajustar");
    if (limitado) return limitado;
    const r = await ajustarDocumento(usuarioId, rol, id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
