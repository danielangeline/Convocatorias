import type { NextRequest } from "next/server";
import { conAdministrador } from "@/lib/admin/api";
import { guardarConvocatoria, obtenerConvocatoria } from "@/lib/admin/catalogo";

type Params = { params: Promise<{ id: string }> };

// CU-02 · Ficha completa de una convocatoria para el editor del panel.
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conAdministrador(
    request,
    async () => {
      const convocatoria = await obtenerConvocatoria(id);
      return convocatoria
        ? { ok: true, datos: convocatoria }
        : { ok: false, status: 404, error: "La convocatoria no existe." };
    },
    { id }
  );
}

// CU-02 2a, CU-04 · Datos, categorías y requisitos en una transacción (RF-05, RF-06, RF-08, RNF-29).
// No cambia el estado: publicar es RF-09.
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  return conAdministrador(request, (cuerpo) => guardarConvocatoria(id, cuerpo), { id });
}
