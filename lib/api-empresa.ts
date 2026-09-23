import "server-only";
import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Segunda barrera de los endpoints del portal Empresa (RNF-30, RN-33): la
 * primera es proxy.ts y la tercera la RLS. Responde como el resto del portal:
 * 401 sin sesión y 403 con otro rol, en JSON.
 */
export async function conEmpresa(accion: () => Promise<NextResponse>): Promise<NextResponse> {
  const datos = await obtenerSesion();
  if (!datos) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
  if (datos.sesion.rol !== "empresa") return NextResponse.json({ error: "Acceso denegado." }, { status: 403 });
  return accion();
}
