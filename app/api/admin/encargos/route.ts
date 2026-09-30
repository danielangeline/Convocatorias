import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { listarSolicitudesEquipo } from "@/lib/encargos-servidor";

// CU-26, RF-90 · Solicitudes al equipo: ?estado=esperando_asignacion (por
// defecto, la bandeja) o ?estado=atendido.
export async function GET(request: NextRequest) {
  const estado = request.nextUrl.searchParams.get("estado") ?? "esperando_asignacion";
  return conAdministrador(request, async () => {
    if (estado !== "esperando_asignacion" && estado !== "atendido") return { ok: false, status: 400, error: "Estado no válido." };
    return { ok: true, datos: await listarSolicitudesEquipo(estado) };
  });
}
