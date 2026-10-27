import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";

// RF-11, RF-12, RF-43, CU-07 · Catálogo de la empresa. Se lee en el servidor con
// su sesión: la RLS decide qué existe (RN-33). El layout ya exige el rol.
// `?q=` llega de la búsqueda de la barra superior y solo rellena el cuadro de
// búsqueda: el filtrado sigue siendo el del catálogo.
export default async function CatalogoConvocatoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const busquedaInicial = (typeof q === "string" ? q : "").slice(0, 200);
  // Vigentes y cerradas: la pantalla muestra las cerradas solo bajo el filtro
  // explícito (RF-11, RN-02).
  const [convocatorias, categorias] = await Promise.all([listarCatalogo(true), listarCategoriasActivas()]);
  return <CatalogoEmpresa convocatorias={convocatorias} categorias={categorias} busquedaInicial={busquedaInicial} />;
}
