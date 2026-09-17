import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { sesionDePropietario } from "@/lib/auth";
import { ipDeCabeceras } from "@/lib/autorizacion/eventos";
import type { Contexto, Resultado } from "./administradores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const noEncontrado = () => NextResponse.json({ error: "No encontrado." }, { status: 404 });

function origenDe(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocolo = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocolo}://${host}`;
}

/**
 * Envoltura de los endpoints de gestión de administradores (RF-86):
 *   · sesión del Propietario con aal2, o 404 (segunda barrera; la primera es proxy.ts);
 *   · en escrituras, la petición debe venir del mismo origen (no se aceptan
 *     formularios de otros sitios con la cookie de la sesión);
 *   · el id de la ruta, si lo hay, debe ser un uuid.
 */
export async function conPropietario<T>(
  request: NextRequest,
  accion: (ctx: Contexto) => Promise<Resultado<T>>,
  opciones: { id?: string } = {}
): Promise<NextResponse> {
  const ruta = request.nextUrl.pathname;
  const datos = await sesionDePropietario(ruta);
  if (!datos) return noEncontrado();

  const origen = origenDe(request);
  if (request.method !== "GET" && request.headers.get("origin") !== origen) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }
  if (opciones.id !== undefined && !UUID.test(opciones.id)) return noEncontrado();

  const resultado = await accion({
    propietarioId: datos.sesion.usuarioId,
    ruta,
    ip: ipDeCabeceras(request.headers),
    origen,
  });
  if (!resultado.ok) return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  return NextResponse.json({ ok: true, datos: resultado.datos ?? null, aviso: resultado.aviso ?? null });
}
