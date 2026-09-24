import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { aceptarConsentimiento } from "@/lib/consultor-perfil-servidor";

// RF-88 · La cuenta creada antes de la casilla del registro acepta aquí.
export async function POST(request: NextRequest) {
  return conConsultor(request, async () => {
    const r = await aceptarConsentimiento();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
