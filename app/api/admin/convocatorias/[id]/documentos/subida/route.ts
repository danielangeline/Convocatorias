import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { urlDeSubida } from "@/lib/admin/documentos";

// CU-03 paso 1 · Valida nombre, tipo, extensión y tamaño (RNF-18) y devuelve
// una URL firmada de subida con la ruta que decide el servidor. El archivo va
// del navegador a Storage sin pasar por aquí (docs/05 §9.14).
// Cuerpo: { nombre, tipo, extension, tamanoBytes }.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => urlDeSubida(id, cuerpo), { id });
}
