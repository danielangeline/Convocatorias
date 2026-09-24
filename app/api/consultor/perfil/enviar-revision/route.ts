import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { enviarARevision } from "@/lib/consultor-perfil-servidor";

// RF-24, RF-25 · Enviar o reenviar a revisión. La base comprueba los mínimos,
// también que la foto y la hoja de vida existan en Storage (CU-17); si falta
// algo, 409 con la lista.
export async function POST(request: NextRequest) {
  return conConsultor(request, async (usuarioId) => {
    const r = await enviarARevision(usuarioId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
