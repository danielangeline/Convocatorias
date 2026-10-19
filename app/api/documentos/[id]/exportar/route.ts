import { NextResponse, type NextRequest } from "next/server";
import { conEmpresa } from "@/lib/api-empresa";
import { documentoParaExportar } from "@/lib/documentos-servidor";
import { documentoAWord, nombreArchivo } from "@/lib/documentos-docx";

// RF-60, RF-72 · Descarga en Word, solo la empresa dueña: el consultor recibe
// 403 de `conEmpresa` y un documento ajeno, 404 de la base.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return conEmpresa(request, async (usuarioId) => {
    const r = await documentoParaExportar(usuarioId, id);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const archivo = await documentoAWord(r.datos);
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${nombreArchivo(r.datos.titulo)}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
