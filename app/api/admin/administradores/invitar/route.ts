import type { NextRequest } from "next/server";
import { conPropietario } from "@/lib/admin/api";
import { invitarAdministrador } from "@/lib/admin/administradores";

// CU-41 paso 2-3 · Invitar un administrador (RF-86, RN-32). Cuerpo: { correo, nombre }.
export async function POST(request: NextRequest) {
  return conPropietario(request, async (ctx) => {
    const cuerpo = await request.json().catch(() => null);
    const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo : "";
    const nombre = typeof cuerpo?.nombre === "string" ? cuerpo.nombre : "";
    return invitarAdministrador(ctx, { correo: correo.slice(0, 320), nombre: nombre.slice(0, 200) });
  });
}
