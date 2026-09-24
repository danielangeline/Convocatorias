import { DetallePostulacion } from "@/components/postulaciones/DetallePostulacion";
import { obtenerPostulacion } from "@/lib/postulaciones-servidor";
import { listarProyectos } from "@/lib/proyectos-servidor";

// CU-12, CU-13 · Detalle de la postulación. Una ajena no existe para quien pide (RN-30).
// `?existente=1`: se pidió postular a un par que ya tenía una en curso (CU-11 1c).
export default async function DetallePostulacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ existente?: string }>;
}) {
  const [{ id }, { existente }] = await Promise.all([params, searchParams]);
  const [postulacion, proyectos] = await Promise.all([obtenerPostulacion(id), listarProyectos()]);
  return <DetallePostulacion postulacion={postulacion} proyectos={proyectos} existente={existente === "1"} />;
}
