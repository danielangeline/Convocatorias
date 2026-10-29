import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { adjuntarDesdeEnlace } from "@/lib/admin/documentos";

// La descarga puede tardar hasta 30 s (RNF-37) y después se sube al bucket.
export const maxDuration = 60;

// RF-118, RNF-37 · El servidor descarga el documento de un enlace y lo adjunta
// a la convocatoria. Cuerpo: { url, tipo }. Lo usa la carga masiva (CU-50).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => adjuntarDesdeEnlace(id, cuerpo), { id });
}
