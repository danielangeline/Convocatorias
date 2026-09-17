import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { borrarCategoria, editarCategoria } from "@/lib/admin/catalogo";

// RF-06 · Renombrar o activar/desactivar una categoría. Cuerpo: { nombre?, activa? }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => editarCategoria(id, cuerpo), { id });
}

// RN-07 (precisado en v6, sesión 014) · Borrar una categoría que ninguna
// convocatoria usa. Si ya clasifica algo, 409 con el motivo: se desactiva.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => borrarCategoria(id), { id });
}
