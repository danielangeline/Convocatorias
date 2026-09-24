import { NextResponse, type NextRequest } from "next/server";
import { cuerpoDe } from "@/lib/api-empresa";
import { conConsultor } from "@/lib/api-consultor";
import { registrarArchivo } from "@/lib/consultor-perfil-servidor";

// RF-23 paso 3 · Registra el archivo subido si existe en Storage, con su tipo
// y tamaño reales, y borra el anterior. Cuerpo: { tipo, ruta }.
export async function POST(request: NextRequest) {
  return conConsultor(request, async (usuarioId) => {
    const r = await registrarArchivo(usuarioId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
