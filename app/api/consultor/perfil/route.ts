import { NextResponse, type NextRequest } from "next/server";
import { cuerpoDe } from "@/lib/api-empresa";
import { conConsultor } from "@/lib/api-consultor";
import { guardarPerfil, obtenerPerfilPropio } from "@/lib/consultor-perfil-servidor";

// CU-16 · El perfil propio, tal como lo edita su dueño.
export async function GET(request: NextRequest) {
  return conConsultor(request, async (usuarioId) => {
    const perfil = await obtenerPerfilPropio(usuarioId);
    if (!perfil) return NextResponse.json({ error: "No encontramos tu perfil de consultor." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: perfil });
  });
}

// RF-23 · Datos, especialidades, redes y portafolio en una transacción.
// 409 sin consentimiento (RF-88) o si vacía los mínimos de un perfil en revisión (CU-16 1a).
export async function PATCH(request: NextRequest) {
  return conConsultor(request, async (usuarioId) => {
    const r = await guardarPerfil(usuarioId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
