import type { NextRequest } from "next/server";
import { conPropietario } from "@/lib/admin/api";
import { cancelarInvitacion } from "@/lib/admin/administradores";

// CU-41 3b · Cancelar una invitación y borrar su cuenta sin activar (RF-86).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conPropietario(request, (ctx) => cancelarInvitacion(ctx, id), { id });
}
