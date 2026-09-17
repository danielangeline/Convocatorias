import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { crearConvocatoria, listarConvocatorias } from "@/lib/admin/catalogo";

// CU-02 · Convocatorias en todos sus estados. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarConvocatorias() }));
}

// CU-02 paso 1 · Nace en borrador (RF-05). Cuerpo: { fuenteId, nombre, entidadConvocante, fechaCierre }.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo, usuarioId) => crearConvocatoria(cuerpo, usuarioId));
}
