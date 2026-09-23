import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";

// RF-11, RF-12, RF-43, CU-07 · Catálogo de la empresa. Se lee en el servidor con
// su sesión: la RLS decide qué existe (RN-33). El layout ya exige el rol.
export default async function CatalogoConvocatoriasPage() {
  const [convocatorias, categorias] = await Promise.all([listarCatalogo(), listarCategoriasActivas()]);
  return <CatalogoEmpresa convocatorias={convocatorias} categorias={categorias} />;
}
