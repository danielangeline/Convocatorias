import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Destino del enlace de confirmación de correo (CU-14). Acepta el flujo PKCE
 * (`code`) y el de plantilla con `token_hash`. Tras confirmar, la sesión queda
 * en cookies y /login reparte al inicio de cada rol.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const tipo = url.searchParams.get("type") as EmailOtpType | null;

  const supabase = await crearClienteServidor();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && tipo) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type: tipo })).error;
  }

  return NextResponse.redirect(new URL(ok ? "/login" : "/login?error=enlace", url.origin));
}
