import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { atenderSolicitud } from "@/lib/encargos-servidor";

// CU-26, RF-90 · { nota? }: marca como contactada una solicitud al equipo.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => atenderSolicitud(id, cuerpo), { id });
}
