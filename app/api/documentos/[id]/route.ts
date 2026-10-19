import { NextResponse, type NextRequest } from "next/server";
import { conEmpresaOConsultor, cuerpoDe } from "@/lib/api-empresa";
import { guardarEdicion, obtenerDocumento } from "@/lib/documentos-servidor";

type Params = { params: Promise<{ id: string }> };

// CU-34 · Leer: la dueña, o el consultor autorizado con encargo en curso (RN-27). Si no, 404.
// Cada lectura del consultor queda registrada (RF-79).
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresaOConsultor(request, async () => {
    const doc = await obtenerDocumento(id);
    if (!doc) return NextResponse.json({ error: "El documento no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: doc });
  });
}

// RF-58 · Edición libre y sin costo de las secciones (y del título, solo la dueña).
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresaOConsultor(request, async () => {
    const r = await guardarEdicion(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
