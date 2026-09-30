import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { listarEncargosEmpresa, solicitarEncargo } from "@/lib/encargos-servidor";

// RN-30 · Los encargos de la empresa, con el correo del consultor solo tras
// aceptar (RF-70, RN-26).
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => NextResponse.json({ ok: true, datos: await listarEncargosEmpresa() }));
}

// CU-19, CU-22, CU-23, RF-28, RF-74 · Con `consultorId`, al directorio; sin él,
// al equipo de la plataforma. 409 por RN-36 o convocatoria no vigente.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const r = await solicitarEncargo(await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos }, { status: 201 });
  });
}
