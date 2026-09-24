import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { consecuenciasDeBorrar, eliminarProyecto, guardarProyecto, obtenerProyecto } from "@/lib/proyectos-servidor";

type Params = { params: Promise<{ id: string }> };

// CU-09 · Ficha del proyecto. Uno ajeno no existe para quien pide (RN-30).
// Con ?consecuencias=1 dice qué se perdería al borrarlo (CU-09 2a).
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    if (request.nextUrl.searchParams.get("consecuencias") === "1") {
      const r = await consecuenciasDeBorrar(id);
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
      return NextResponse.json({ ok: true, datos: r.datos });
    }
    const proyecto = await obtenerProyecto(id);
    if (!proyecto) return NextResponse.json({ error: "El proyecto no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: proyecto });
  });
}

// RF-45, RF-81 · Editar datos, contenido y categorías.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await guardarProyecto(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}

// CU-09 2a · Eliminar. 409 si tiene encargos.
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    const r = await eliminarProyecto(id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
