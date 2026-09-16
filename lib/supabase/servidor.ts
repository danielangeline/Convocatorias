import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase con la sesión del usuario (cookies). Todo pasa por RLS.
 * Desde un Server Component las cookies no se pueden escribir; el refresco de
 * la sesión lo hace `proxy.ts`, así que ese fallo se ignora.
 */
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => almacen.getAll(),
      setAll: (porFijar) => {
        try {
          porFijar.forEach(({ name, value, options }) => almacen.set(name, value, options));
        } catch {
          // Server Component: lo resuelve proxy.ts.
        }
      },
    },
  });
}

/**
 * Cliente con service_role: se salta RLS. Solo para código de servidor que
 * escribe lo que el usuario no puede escribir (eventos de seguridad, marca de
 * MFA). Nunca se importa desde un componente de cliente (RNF-26).
 */
export function crearClienteServicio() {
  if (typeof window !== "undefined") {
    throw new Error("El cliente de servicio solo puede usarse en el servidor (RNF-26)");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
