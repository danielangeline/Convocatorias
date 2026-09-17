import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { editarFuente } from "@/lib/admin/catalogo";

// CU-01 3a/3b · Editar o desactivar una fuente; no se borra (RF-04, RN-07).
// Cuerpo: { nombre, tipoEntidad?, url?, notas?, activa }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => editarFuente(id, cuerpo), { id });
}
