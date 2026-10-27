import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// RF-88 · La empresa creada antes de la casilla del registro (sesión 021)
// acepta aquí el tratamiento de datos. La función de la base usa auth.uid():
// solo marca la cuenta de la sesión, y solo la primera vez.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.rpc("aceptar_consentimiento_datos");
    if (error) {
      console.error("Consentimiento: no se pudo registrar", error.code, error.message);
      return NextResponse.json({ error: "No pudimos registrar tu autorización. Intenta de nuevo." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, datos: null });
  });
}
