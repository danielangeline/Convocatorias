import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { guardarConvocatoria, listarGuardadas } from "@/lib/guardadas-servidor";

// RF-103 · Las convocatorias que la empresa guardó: la RLS solo deja ver las suyas.
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => NextResponse.json({ ok: true, datos: await listarGuardadas() }));
}

// RF-103 · Guardar. El dueño lo fija la base (auth.uid()); solo las que la RLS deja ver.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const r = await guardarConvocatoria((await cuerpoDe(request))?.convocatoriaId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
