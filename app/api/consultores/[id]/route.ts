import { NextResponse, type NextRequest } from "next/server";
import { UUID, conEmpresa } from "@/lib/api-empresa";
import { obtenerPerfilPublico } from "@/lib/consultores-directorio";
import { exigirFuncion } from "@/lib/plan-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";

type Params = { params: Promise<{ id: string }> };

// CU-21 · RF-27, RF-80. Sin contacto salvo encargo en curso de esta empresa.
// Fuera del directorio (no aprobado o equipo interno): 404.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conEmpresa(request, async () => {
    // RN-41 (sesión 042): sin el plan Pro, solo el perfil de un consultor con
    // el que ya tiene un encargo (lo creado sigue siendo de la empresa).
    const sinFuncion = UUID.test(id) ? await exigirFuncion("consultores") : null;
    if (sinFuncion) {
      const supabase = await crearClienteServidor();
      const { data: encargo } = await supabase.from("encargos").select("id").eq("consultor_id", id).limit(1).maybeSingle();
      if (!encargo) return NextResponse.json({ error: sinFuncion.error }, { status: sinFuncion.status });
    }
    const perfil = UUID.test(id) ? await obtenerPerfilPublico(id) : null;
    if (!perfil) return NextResponse.json({ error: "No encontramos este consultor." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: perfil });
  });
}
