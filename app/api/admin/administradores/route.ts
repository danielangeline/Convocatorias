import type { NextRequest } from "next/server";
import { conPropietario } from "@/lib/admin/api";
import { listarAdministradores } from "@/lib/admin/administradores";

// CU-41 · Administradores activos, revocados e invitaciones. Solo el Propietario (RF-86).
export async function GET(request: NextRequest) {
  return conPropietario(request, async () => ({ ok: true, datos: await listarAdministradores() }));
}
