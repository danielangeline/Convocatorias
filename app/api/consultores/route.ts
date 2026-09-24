import { NextResponse, type NextRequest } from "next/server";
import { UUID, conEmpresa } from "@/lib/api-empresa";
import { listarDirectorio } from "@/lib/consultores-directorio";

// CU-20 · RF-26. Aprobados y fuera del equipo interno; filtros opcionales:
// q, especialidad (ids separados por comas) y ratingMin (0 a 5).
export async function GET(request: NextRequest) {
  return conEmpresa(request, async () => {
    const p = request.nextUrl.searchParams;
    const especialidades = (p.get("especialidad") ?? "").split(",").filter(Boolean);
    if (especialidades.some((e) => !UUID.test(e))) {
      return NextResponse.json({ error: "Especialidad no válida." }, { status: 400 });
    }
    const ratingMin = p.has("ratingMin") ? Number(p.get("ratingMin")) : 0;
    if (!Number.isFinite(ratingMin) || ratingMin < 0 || ratingMin > 5) {
      return NextResponse.json({ error: "El rating mínimo va de 0 a 5." }, { status: 400 });
    }
    const q = (p.get("q") ?? "").slice(0, 120);
    return NextResponse.json({ ok: true, datos: await listarDirectorio({ q, especialidades, ratingMin }) });
  });
}
