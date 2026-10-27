import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { quitarGuardada } from "@/lib/guardadas-servidor";

// RF-103 · Quitar de las guardadas. La RLS solo deja borrar las propias.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conEmpresa(request, async () => {
    const r = await quitarGuardada((await params).id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
