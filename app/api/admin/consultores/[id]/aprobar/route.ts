import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { aprobarPerfil } from "@/lib/admin/consultores";

// CU-25 · RF-34. Solo un perfil en revisión (409 si otro administrador ya actuó).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => aprobarPerfil(id), { id });
}
