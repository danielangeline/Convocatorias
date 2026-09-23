import { NextResponse } from "next/server";
import { obtenerIndicadores } from "@/lib/catalogo";

// RF-44 · Las cuatro cifras de la landing. Pública: son agregados que no
// exponen ninguna convocatoria (RN-33). Caché de 1 hora en el servidor.
export async function GET() {
  const datos = await obtenerIndicadores();
  if (!datos) return NextResponse.json({ error: "No pudimos calcular los indicadores." }, { status: 503 });
  return NextResponse.json({ ok: true, datos }, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}
