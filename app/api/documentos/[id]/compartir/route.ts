import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { compartirDocumento } from "@/lib/documentos-servidor";

// RF-71, RN-22 · La empresa dueña autoriza al consultor de un encargo en curso.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conEmpresa(request, async (usuarioId) => {
    const r = await compartirDocumento(usuarioId, id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
