import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { estructurarProyecto } from "@/lib/proyectos-ia-servidor";

// La IA tiene hasta 60 s; el resto es margen para reservar y cobrar.
export const maxDuration = 90;

// CU-43, RF-96 · Propuesta del formulario a partir de la explicación de la
// empresa. Un crédito solo si la entrega (RN-17). No guarda el proyecto.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async (usuarioId) => {
    const r = await estructurarProyecto(usuarioId, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
