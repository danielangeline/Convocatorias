import { NextResponse, type NextRequest } from "next/server";
import { conEmpresaOConsultor } from "@/lib/api-empresa";
import { listarDocumentos } from "@/lib/documentos-servidor";

// RN-30, RN-27 · La empresa ve los suyos (la última versión de cada par); el
// consultor, solo los que le autorizaron con su encargo en curso. Lo decide la RLS.
export async function GET(request: NextRequest) {
  return conEmpresaOConsultor(request, async () => NextResponse.json({ ok: true, datos: await listarDocumentos() }));
}
