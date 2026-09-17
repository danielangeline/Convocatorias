import type { NextRequest } from "next/server";
import { conPropietario } from "@/lib/admin/api";
import { revocarAdministrador } from "@/lib/admin/administradores";

// CU-41 paso 4-5 · Revocar el acceso de un administrador (RF-87, RN-31).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conPropietario(request, (ctx) => revocarAdministrador(ctx, id), { id });
}
