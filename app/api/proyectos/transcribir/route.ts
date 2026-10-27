import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { transcribirAudio } from "@/lib/proyectos-ia-servidor";
import { limitarIA } from "@/lib/limite-tasa";

export const maxDuration = 90;

// CU-43, RF-97 · Dictado: transcribe el audio grabado en el navegador. No cobra
// crédito; el audio no se guarda.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async (usuarioId) => {
    // RF-66, RNF-27: antes de reservar crédito o llamar a la IA.
    const limitado = await limitarIA(usuarioId, "/api/proyectos/transcribir");
    if (limitado) return limitado;
    const formulario = await request.formData().catch(() => null);
    const r = await transcribirAudio(usuarioId, formulario);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
