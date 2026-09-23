import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";

// RF-11, RF-12, RF-43, CU-07 · Catálogo de la empresa. Se lee en el servidor con
// su sesión: la RLS decide qué existe (RN-33). El layout ya exige el rol.
export default async function CatalogoConvocatoriasPage() {
  // Vigentes y cerradas: la pantalla muestra las cerradas solo bajo el filtro
  // explícito (RF-11, RN-02).
  const [convocatorias, categorias] = await Promise.all([listarCatalogo(true), listarCategoriasActivas()]);
  return <CatalogoEmpresa convocatorias={convocatorias} categorias={categorias} />;
}
