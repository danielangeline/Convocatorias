import type { NextRequest } from "next/server";
import { conPropietario } from "@/lib/admin/api";
import { reenviarInvitacion } from "@/lib/admin/administradores";

// CU-41 3b, CU-42 1b · Reenviar el enlace de una invitación vigente (RF-86).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conPropietario(request, (ctx) => reenviarInvitacion(ctx, id), { id });
}
