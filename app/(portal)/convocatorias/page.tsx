import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { compatibilidadEmpresa } from "@/lib/compatibilidad-empresa";
import { listarGuardadas } from "@/lib/guardadas-servidor";

// RF-11, RF-12, RF-43, CU-07 · Catálogo de la empresa. Se lee en el servidor con
// su sesión: la RLS decide qué existe (RN-33). El layout ya exige el rol.
// `?q=` llega de la búsqueda de la barra superior y solo rellena el cuadro de
// búsqueda; `?tipo=` preselecciona fondos o beneficios tributarios (RF-102).
// La compatibilidad es la de CU-10 (RN-05) y las guardadas, las de RF-103.
export default async function CatalogoConvocatoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tipo?: string | string[] }>;
}) {
  const { q, tipo } = await searchParams;
  const busquedaInicial = (typeof q === "string" ? q : "").slice(0, 200);
  const tipoInicial = tipo === "fondo" || tipo === "beneficio_tributario" ? tipo : "todas";
  // Vigentes y cerradas: la pantalla muestra las cerradas solo bajo el filtro
  // explícito (RF-11, RN-02).
  const [convocatorias, categorias, compat, guardadas] = await Promise.all([
    listarCatalogo(true),
    listarCategoriasActivas(),
    compatibilidadEmpresa(),
    listarGuardadas(),
  ]);
  const compatibilidad = Object.fromEntries([...compat.porConvocatoria.values()].map((c) => [c.convocatoria.id, c.porcentaje]));
  return (
    <CatalogoEmpresa
      // El menú cambia el tipo con una navegación: se vuelve a montar con el nuevo.
      key={`${tipoInicial}|${busquedaInicial}`}
      convocatorias={convocatorias}
      categorias={categorias}
      busquedaInicial={busquedaInicial}
      tipoInicial={tipoInicial}
      compatibilidad={compatibilidad}
      guardadas={guardadas}
    />
  );
}
