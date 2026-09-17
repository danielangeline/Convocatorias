import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { enlaceDeDescarga } from "@/lib/admin/documentos";

// RNF-16 · URL firmada de descarga, válida 15 minutos. Quién puede pedirla lo
// decide la RLS sobre la fila, no esta ruta: el mismo endpoint servirá a la
// empresa cuando llegue su catálogo (docs/05 §9.14).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  return conAdministrador(request, () => enlaceDeDescarga(id, docId), { ids: [id, docId] });
}
