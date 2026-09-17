import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { quitarDocumento, renombrarDocumento } from "@/lib/admin/documentos";

type Params = { params: Promise<{ id: string; docId: string }> };

// CU-03 1a · Renombrar o cambiar el tipo. El archivo no se reemplaza por aquí:
// lo impide un trigger de la base (docs/05 §9.14). Cuerpo: { nombre?, tipo? }.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  return conAdministrador(request, (cuerpo) => renombrarDocumento(id, docId, cuerpo), { ids: [id, docId] });
}

// CU-03 1a · Quita el adjunto: la fila y el objeto del bucket.
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id, docId } = await params;
  return conAdministrador(request, () => quitarDocumento(id, docId), { ids: [id, docId] });
}
