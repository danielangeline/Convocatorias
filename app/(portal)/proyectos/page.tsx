import { ListadoProyectos } from "@/components/proyectos/ListadoProyectos";
import { listarCategoriasActivas } from "@/lib/catalogo";
import { listarProyectos } from "@/lib/proyectos-servidor";

// RF-14, CU-09 · Los proyectos de la empresa, leídos con su sesión (RN-30).
export default async function ProyectosPage() {
  const [proyectos, categorias] = await Promise.all([listarProyectos(), listarCategoriasActivas()]);
  return <ListadoProyectos proyectos={proyectos} categorias={categorias} />;
}
