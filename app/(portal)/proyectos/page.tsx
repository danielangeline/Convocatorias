import { ListadoProyectos } from "@/components/proyectos/ListadoProyectos";
import { listarCategoriasActivas } from "@/lib/catalogo";
import { listarProyectos } from "@/lib/proyectos-servidor";
import { compatibilidadEmpresa } from "@/lib/compatibilidad-empresa";

// RF-14, CU-09 · Los proyectos de la empresa, leídos con su sesión (RN-30).
export default async function ProyectosPage() {
  const [proyectos, categorias, compat] = await Promise.all([listarProyectos(), listarCategoriasActivas(), compatibilidadEmpresa()]);
  return <ListadoProyectos proyectos={proyectos} categorias={categorias} compatiblesPorProyecto={compat.compatiblesPorProyecto} />;
}
