import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { crearVersionPlantilla, listarPlantillas } from "@/lib/admin/plantillas";

// CU-37 · RF-63 · Versiones de la plantilla de generación. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarPlantillas() }));
}

// Cuerpo: { contenido, modelo, precioEntradaUsdMtok, precioSalidaUsdMtok, topeCaracteresTdr }. Crea la versión siguiente, inactiva.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => crearVersionPlantilla(cuerpo));
}
