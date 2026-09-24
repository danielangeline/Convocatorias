import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { guardarProyecto, listarProyectos } from "@/lib/proyectos-servidor";

// RF-14, RN-30 · Los proyectos de la empresa: la RLS solo deja ver los suyos.
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => NextResponse.json({ ok: true, datos: await listarProyectos() }));
}

// RF-14, RF-45, CU-09 · Crear. El dueño lo fija la base (auth.uid()), nunca el cuerpo.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const r = await guardarProyecto(null, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
