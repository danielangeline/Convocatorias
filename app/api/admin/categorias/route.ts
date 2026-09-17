import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { crearCategoria, listarCategorias } from "@/lib/admin/catalogo";

// RF-06 · Categorías para clasificar convocatorias. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarCategorias() }));
}

// Cuerpo: { tipo: "tipo_proyecto" | "sector" | "tipo_entidad", nombre }.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => crearCategoria(cuerpo));
}
