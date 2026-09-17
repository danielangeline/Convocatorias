import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { editarCategoria } from "@/lib/admin/catalogo";

// RF-06 · Renombrar o activar/desactivar una categoría. Cuerpo: { nombre?, activa? }.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => editarCategoria(id, cuerpo), { id });
}
