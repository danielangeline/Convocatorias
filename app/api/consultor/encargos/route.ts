import { NextResponse, type NextRequest } from "next/server";
import { conConsultor } from "@/lib/api-consultor";
import { listarEncargosConsultor } from "@/lib/encargos-servidor";

// CU-18, RF-68, RF-69, RN-25 · Los encargos del consultor, con el contexto que
// la base le deja leer mientras están pendientes o en curso.
export async function GET(request: NextRequest) {
  return conConsultor(request, async () => NextResponse.json({ ok: true, datos: await listarEncargosConsultor() }));
}
