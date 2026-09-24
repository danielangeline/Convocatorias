import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerSesion } from "@/lib/auth";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function origenDe(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocolo = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocolo}://${host}`;
}

/**
 * Segunda barrera de los endpoints del portal Empresa (RNF-30, RN-33): la
 * primera es proxy.ts y la tercera la RLS. Responde como el resto del portal:
 * 401 sin sesión y 403 con otro rol, en JSON. En escrituras exige además el
 * mismo origen, para que un formulario de otro sitio no use la cookie de la
 * empresa (igual que el panel).
 */
export async function conEmpresa(
  request: NextRequest,
  accion: (usuarioId: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const datos = await obtenerSesion();
  if (!datos) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  if (datos.sesion.rol !== "empresa") return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  if (request.method !== "GET" && request.headers.get("origin") !== origenDe(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  return accion(datos.sesion.usuarioId);
}

/** Lee el cuerpo JSON como objeto; null si no lo es. */
export async function cuerpoDe(request: NextRequest): Promise<Record<string, unknown> | null> {
  const leido = await request.json().catch(() => null);
  return leido && typeof leido === "object" && !Array.isArray(leido) ? leido : null;
}
