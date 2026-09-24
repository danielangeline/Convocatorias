import { NextResponse, type NextRequest } from "next/server";
import { cuerpoDe } from "@/lib/api-empresa";
import { conConsultor } from "@/lib/api-consultor";
import { urlDeSubida } from "@/lib/consultor-perfil-servidor";

// RF-23 paso 1 · Valida tipo y tamaño y firma la subida de la foto o la hoja de
// vida, con la ruta que decide el servidor. Cuerpo: { tipo, nombreArchivo, tamanoBytes }.
export async function POST(request: NextRequest) {
  return conConsultor(request, async (usuarioId) => {
    const r = await urlDeSubida(usuarioId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
