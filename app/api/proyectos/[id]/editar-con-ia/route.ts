import { NextResponse, type NextRequest } from "next/server";
import { UUID, conEmpresa, cuerpoDe } from "@/lib/api-empresa";
import { editarApartadoConIA } from "@/lib/proyectos-ia-servidor";
import { limitarIA } from "@/lib/limite-tasa";

// La IA tiene hasta 45 s; el resto es margen para reservar y cobrar.
export const maxDuration = 75;

// CU-47, RF-109 · Propuesta de la IA para un apartado del proyecto. Cobra la
// tarifa «editar apartado» solo si la entrega (RN-17). No guarda nada (RN-37).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return conEmpresa(request, async (usuarioId) => {
    const { id } = await params;
    if (!UUID.test(id)) return NextResponse.json({ error: "El proyecto no existe." }, { status: 404 });
    // RF-66, RNF-27: antes de reservar crédito o llamar a la IA.
    const limitado = await limitarIA(usuarioId, "/api/proyectos/editar-con-ia");
    if (limitado) return limitado;
    const r = await editarApartadoConIA(usuarioId, id, await cuerpoDe(request));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    return NextResponse.json({ ok: true, datos: r.datos });
  });
}
