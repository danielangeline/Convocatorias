import { FichaConvocatoria } from "@/components/catalogo/FichaConvocatoria";
import { listarCategoriasActivas, listarPaises, obtenerFicha } from "@/lib/catalogo";
import { textoPaises } from "@/lib/monedas";
import { listarGuardadas } from "@/lib/guardadas-servidor";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RF-13, CU-08 · Ficha leída con la sesión de la empresa: si la RLS no deja
// verla, para ella no existe (RN-33).
export default async function DetalleConvocatoriaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [convocatoria, categorias, guardadas, paises] = await Promise.all([
    UUID.test(id) ? obtenerFicha(id) : Promise.resolve(null),
    listarCategoriasActivas(),
    listarGuardadas(),
    listarPaises(),
  ]);
  const paisesTexto = convocatoria ? textoPaises(convocatoria, new Map(paises.map((p) => [p.codigo, p.nombre]))) : undefined;
  return <FichaConvocatoria convocatoria={convocatoria} categorias={categorias} guardada={guardadas.includes(id)} paisesTexto={paisesTexto} />;
}
