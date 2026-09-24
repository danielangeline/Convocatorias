import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { iniciarPostulacion, listarPostulaciones } from "@/lib/postulaciones-servidor";

// RN-30 · Las postulaciones de la empresa: la RLS solo deja ver las suyas.
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => NextResponse.json({ ok: true, datos: await listarPostulaciones() }));
}

// RF-17, RF-78, RN-35, CU-11 · Iniciar. 201 si la crea; 200 con la que ya estaba
// en curso para ese par proyecto-convocatoria (CU-11 1c).
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const r = await iniciarPostulacion(await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos }, { status: r.datos.creada ? 201 : 200 });
  });
}
