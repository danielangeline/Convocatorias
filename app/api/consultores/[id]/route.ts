import { NextResponse, type NextRequest } from "next/server";
import { UUID, conEmpresa } from "@/lib/api-empresa";
import { obtenerPerfilPublico } from "@/lib/consultores-directorio";

type Params = { params: Promise<{ id: string }> };

// CU-21 · RF-27, RF-80. Sin contacto salvo encargo en curso de esta empresa.
// Fuera del directorio (no aprobado o equipo interno): 404.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const perfil = UUID.test(id) ? await obtenerPerfilPublico(id) : null;
    if (!perfil) return NextResponse.json({ error: "No encontramos este consultor." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: perfil });
  });
}
