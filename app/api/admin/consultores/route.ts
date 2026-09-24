import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { esEstadoPerfil, listarConsultores } from "@/lib/admin/consultores";

// CU-25 · CU-27. Todos los consultores, o la bandeja con ?estado=en_revision.
export async function GET(request: NextRequest) {
  const estado = request.nextUrl.searchParams.get("estado");
  return conAdministrador(request, async () => {
    if (estado !== null && !esEstadoPerfil(estado)) return { ok: false, status: 400, error: "Estado no válido." };
    return { ok: true, datos: await listarConsultores(estado ?? undefined) };
  });
}
