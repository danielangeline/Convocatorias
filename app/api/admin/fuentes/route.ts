import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { crearFuente, listarFuentes } from "@/lib/admin/catalogo";

// CU-01 · Fuentes de convocatorias (RF-04). Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarFuentes() }));
}

// Cuerpo: { nombre, tipoEntidad?, url?, notas?, activa? }.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => crearFuente(cuerpo));
}
