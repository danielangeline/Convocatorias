import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth";
import { origenDe } from "@/lib/api-empresa";

/**
 * Segunda barrera de los endpoints del portal Consultor (RNF-30): la primera
 * es proxy.ts y la tercera la RLS. Igual que `conEmpresa`: 401 sin sesión, 403
 * con otro rol y, en escrituras, mismo origen.
 */
export async function conConsultor(
  request: NextRequest,
  accion: (usuarioId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const datos = await obtenerSesion();
  if (!datos) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  if (datos.sesion.rol !== "consultor") return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  if (request.method !== "GET" && request.headers.get("origin") !== origenDe(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  return accion(datos.sesion.usuarioId);
}
