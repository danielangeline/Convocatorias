import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { liberarBloqueo } from "@/lib/admin/seguridad";

// CU-40 · RF-67 · Liberar un bloqueo por límite de tasa. Solo administrador con MFA; al resto, 404 (RF-85).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, () => liberarBloqueo(id), { id });
}
