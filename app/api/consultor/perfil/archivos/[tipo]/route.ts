import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { enlaceDeArchivo } from "@/lib/consultor-perfil-servidor";

// RNF-16 · URL firmada de 15 minutos de la foto o la hoja de vida propias.
export async function GET(request: NextRequest, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  return conConsultor(request, async (usuarioId) => {
    const r = await enlaceDeArchivo(usuarioId, tipo);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
