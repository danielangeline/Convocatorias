import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { cambiarPublicacion } from "@/lib/admin/catalogo";

// CU-05 · Publicar. 400 con la lista de lo que falta (RF-09, RN-01, RNF-29).
// Los adjuntos no se exigen: advertirlo es cosa de la pantalla (CU-05 3d).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => cambiarPublicacion(id, true), { id });
}
