import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { reglaDeRuta } from "@/lib/autorizacion/matriz";
import { ipDeCabeceras, registrarAccesoDenegado } from "@/lib/autorizacion/eventos";
import type { RolUsuario } from "@/lib/types";

/**
 * Refresca la sesión de Supabase Auth y aplica la matriz rol × ruta (RNF-30)
 * a cada petición antes de que llegue a la aplicación:
 *   · ruta no declarada → 404 (cerrado por defecto);
 *   · sin sesión → /login, salvo en el panel, que responde 404 (RF-85);
 *   · rol no admitido → 403, o 404 en el panel, y evento `acceso_denegado`;
 *   · panel sin segundo factor verificado → /mfa (RNF-28).
 * Los layouts repiten la comprobación (`exigirRol`) como segunda barrera.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (porFijar, cabeceras) => {
        porFijar.forEach(({ name, value }) => request.cookies.set(name, value));
        respuesta = NextResponse.next({ request });
        porFijar.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options));
        Object.entries(cabeceras ?? {}).forEach(([clave, valor]) => respuesta.headers.set(clave, valor));
      },
    },
  });

  // Valida el JWT y lo renueva si hace falta. No debe haber código entre la
  // creación del cliente y esta llamada.
  const { data } = await supabase.auth.getClaims();

  const ruta = request.nextUrl.pathname;
  const regla = reglaDeRuta(ruta);

  // Las respuestas que no siguen de largo conservan las cookies renovadas.
  const conSesion = (destino: NextResponse) => {
    respuesta.cookies.getAll().forEach((cookie) => destino.cookies.set(cookie));
    return destino;
  };
  // Misma respuesta que una ruta inexistente: se reescribe a una que no existe.
  const noEncontrada = () => conSesion(NextResponse.rewrite(new URL("/__ruta-inexistente", request.url)));

  if (!regla) return noEncontrada();
  if (regla.tipo === "publica") return respuesta;

  const claims = data?.claims;
  const usuarioId = typeof claims?.sub === "string" ? claims.sub : null;
  // Las precargas de enlaces no cuentan como intento de acceso.
  const esPrecarga = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";

  const denegar = async (detalle: string) => {
    if (!esPrecarga) {
      await registrarAccesoDenegado({ usuarioId, ruta, ip: ipDeCabeceras(request.headers), detalle });
    }
    if (regla.oculta) return noEncontrada();
    return conSesion(NextResponse.rewrite(new URL("/acceso-denegado", request.url), { status: 403 }));
  };

  if (!usuarioId) {
    if (regla.oculta) return denegar("Sin sesión");
    return conSesion(NextResponse.redirect(new URL("/login", request.url)));
  }

  // Rol efectivo desde la base: nulo para un administrador revocado o con la
  // invitación vencida sin activar (docs/05 §9.12, RF-87).
  const { data: rolEfectivo } = await supabase.rpc("rol_efectivo");
  const rol = typeof rolEfectivo === "string" ? (rolEfectivo as RolUsuario) : null;
  if (!rol || !regla.roles.includes(rol)) {
    return denegar(`Rol ${rol ?? "sin perfil válido"} no admitido`);
  }

  if (regla.exigeMfa && claims?.aal !== "aal2") {
    return conSesion(NextResponse.redirect(new URL("/mfa", request.url)));
  }

  return respuesta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
