import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { revocarDocumento } from "@/lib/documentos-servidor";

// RF-71 · La empresa dueña quita la autorización; el acceso se pierde en la siguiente petición.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conEmpresa(request, async (usuarioId) => {
    const r = await revocarDocumento(usuarioId, id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
