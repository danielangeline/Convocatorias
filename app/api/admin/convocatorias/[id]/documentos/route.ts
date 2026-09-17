import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { listarDocumentos, registrarDocumento } from "@/lib/admin/documentos";

type Params = { params: Promise<{ id: string }> };

// CU-03 · Adjuntos de la convocatoria (RF-07).
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conAdministrador(request, async () => ({ ok: true, datos: await listarDocumentos(id) }), { id });
}

// CU-03 paso 3 · Registra la fila del archivo ya subido a Storage, tras
// comprobar que el objeto existe y con el tamaño y el tipo reales (docs/05 §9.14).
// Cuerpo: { documentoId, nombre, tipo, extension }.
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => registrarDocumento(id, cuerpo), { id });
}
