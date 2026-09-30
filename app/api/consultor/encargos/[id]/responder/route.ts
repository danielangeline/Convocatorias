import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { cuerpoDe } from "@/lib/api-empresa";
import { responderEncargo } from "@/lib/encargos-servidor";

type Params = { params: Promise<{ id: string }> };

// RF-30, CU-18 · { acepta }: aceptar revela el correo de la empresa (RF-70).
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conConsultor(request, async () => {
    const r = await responderEncargo(id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: null });
  });
}
