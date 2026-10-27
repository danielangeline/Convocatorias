import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { crearVersionPlantillaProyecto, listarPlantillasProyecto } from "@/lib/admin/plantillas";

// CU-37 · RF-99 · Versiones de la plantilla de creación de proyectos. Solo administrador con MFA; al resto, 404 (RF-85).
export async function GET(request: NextRequest) {
  return conAdministrador(request, async () => ({ ok: true, datos: await listarPlantillasProyecto() }));
}

// Cuerpo: { contenido, modelo, precioEntradaUsdMtok, precioSalidaUsdMtok }. Crea la versión siguiente, inactiva.
export async function POST(request: NextRequest) {
  return conAdministrador(request, (cuerpo) => crearVersionPlantillaProyecto(cuerpo));
}
