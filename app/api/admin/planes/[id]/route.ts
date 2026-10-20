import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { guardarPlan } from "@/lib/admin/suscripciones";

// RF-36 · Edita o desactiva un plan (un plan no se borra, docs/05 §9.28).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => guardarPlan(id, cuerpo), { id });
}
