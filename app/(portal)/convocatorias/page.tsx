import { CatalogoEmpresa } from "@/components/catalogo/CatalogoEmpresa";
import { listarCatalogo, listarCategoriasActivas } from "@/lib/catalogo";
import { compatibilidadEmpresa, idsNuevasEstaSemana } from "@/lib/compatibilidad-empresa";
import { listarGuardadas } from "@/lib/guardadas-servidor";

// RF-11, RF-12, RF-43, CU-07 · Catálogo de la empresa. Se lee en el servidor con
// su sesión: la RLS decide qué existe (RN-33). El layout ya exige el rol.
// `?q=` llega de la búsqueda de la barra superior y solo rellena el cuadro de
// búsqueda; `?tipo=` preselecciona fondos o beneficios tributarios (RF-102).
// La compatibilidad es la de CU-10 (RN-05) y las guardadas, las de RF-103.
export default async function CatalogoConvocatoriasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[]; tipo?: string | string[]; tab?: string | string[] }>;
}) {
  const { q, tipo, tab } = await searchParams;
  const busquedaInicial = (typeof q === "string" ? q : "").slice(0, 200);
  const tipoInicial = tipo === "fondo" || tipo === "beneficio_tributario" ? tipo : "todas";
  const tabInicial = tab === "sugeridas" || tab === "guardadas" ? tab : "todas";
  // Vigentes y cerradas, de todos los países: la pantalla muestra las cerradas y
  // las de otros países solo bajo su filtro explícito (RF-11, RN-02, RN-39).
  const [convocatorias, categorias, compat, guardadas] = await Promise.all([
    listarCatalogo(true, true),
    listarCategoriasActivas(),
    compatibilidadEmpresa(),
    listarGuardadas(),
  ]);
  const compatibilidad = Object.fromEntries([...compat.porConvocatoria.values()].map((c) => [c.convocatoria.id, c.porcentaje]));
  const proyectoPorConvocatoria = Object.fromEntries([...compat.porConvocatoria.values()].map((c) => [c.convocatoria.id, c.proyectoNombre]));
  const nuevasIds = idsNuevasEstaSemana(convocatorias);
  return (
    <CatalogoEmpresa
      // El menú cambia el tipo con una navegación: se vuelve a montar con el nuevo.
      key={`${tipoInicial}|${busquedaInicial}|${tabInicial}`}
      convocatorias={convocatorias}
      categorias={categorias}
      busquedaInicial={busquedaInicial}
      tipoInicial={tipoInicial}
      compatibilidad={compatibilidad}
      guardadas={guardadas}
      tabInicial={tabInicial}
      nuevasIds={nuevasIds}
      proyectoPorConvocatoria={proyectoPorConvocatoria}
    />
  );
}
