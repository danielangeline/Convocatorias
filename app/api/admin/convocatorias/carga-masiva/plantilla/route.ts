import { NextResponse, type NextRequest } from "next/server";
import { sesionDeAdministrador } from "@/lib/auth";
import { plantillaExcel } from "@/lib/admin/plantilla-excel";
import { hoyColombia } from "@/lib/fechas";

// CU-50 2a, RF-118 (sesión 039) · Plantilla en Excel con el prompt para el
// agente y las listas válidas del momento. Solo administrador con aal2: a los
// demás, 404 como todo /api/admin (RF-85).
export async function GET(request: NextRequest) {
  if (!(await sesionDeAdministrador(request.nextUrl.pathname))) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const archivo = await plantillaExcel();
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla-convocatorias-${hoyColombia()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
