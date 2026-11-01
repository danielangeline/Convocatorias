import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// RF-119 · La empresa terminó u omitió el recorrido de bienvenida (CU-51).
// La función de la base usa auth.uid(): solo marca la cuenta de la sesión, y
// solo la primera vez.
export async function POST(request: NextRequest) {
  return conEmpresa(request, async () => {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.rpc("marcar_recorrido_visto");
    if (error) {
      console.error("Recorrido: no se pudo registrar", error.code, error.message);
      return NextResponse.json({ error: "No pudimos guardar que viste el recorrido." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, datos: null });
  });
}
